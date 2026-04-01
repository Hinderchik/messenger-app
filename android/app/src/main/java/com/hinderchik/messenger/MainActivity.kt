package com.hinderchik.messenger

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.view.Display
import android.view.Surface
import android.view.SurfaceView
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import java.security.MessageDigest
import okhttp3.*
import com.google.gson.Gson
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder.AudioSource
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer

data class User(val id: String, val username: String, var online: Boolean = false, var inCall: Boolean = false)
data class Message(val id: String, val fromId: String, val toId: String, val text: String, val time: Long, val type: String = "text")
data class CallOffer(val from: String, val fromName: String, val offer: String)
data class CallAnswer(val answer: String)
data class IceCandidate(val candidate: String, val sdpMid: String, val sdpMLineIndex: Int)
data class ScreenShareFrame(val data: String, val width: Int, val height: Int)

class MainActivity : AppCompatActivity() {
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var usersAdapter: UsersAdapter
    private val messages = mutableListOf<Message>()
    private var currentUser: User? = null
    private var currentChat: User? = null
    private lateinit var sharedPrefs: SharedPreferences
    private lateinit var webSocket: WebSocketClient
    private val gson = Gson()
    private val client = OkHttpClient()
    private lateinit var usersList: MutableList<User>
    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var usersRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var callButton: ImageButton
    private lateinit var screenShareButton: ImageButton
    
    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var isInCall = false
    private var currentCallWith: String? = null
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var isRecording = false
    private var udpSocket: DatagramSocket? = null
    private var targetAddress: InetAddress? = null
    private val audioBufferSize = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    
    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var surfaceView: SurfaceView? = null
    private var isScreenSharing = false
    private val SCREEN_SHARE_PORT = 12346

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 100
        private const val REQUEST_CODE_SCREEN_CAPTURE = 101
        private const val REQUEST_AUDIO_PERMISSION = 102
        private val REQUIRED_PERMISSIONS = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.INTERNET,
                Manifest.permission.FOREGROUND_SERVICE,
                Manifest.permission.POST_NOTIFICATIONS
            )
        } else {
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.INTERNET
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        checkPermissions()
        
        val masterKey = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        sharedPrefs = EncryptedSharedPreferences.create(
            "secure_prefs", masterKey, this,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        
        setupUI()
        checkAuth()
    }
    
    private fun checkPermissions() {
        val missingPermissions = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), REQUEST_CODE_PERMISSIONS)
        }
    }
    
    private fun setupUI() {
        messagesRecyclerView = findViewById(R.id.messagesRecyclerView)
        usersRecyclerView = findViewById(R.id.usersRecyclerView)
        messageInput = findViewById(R.id.messageInput)
        callButton = findViewById(R.id.callButton)
        screenShareButton = findViewById(R.id.screenShareButton)
        surfaceView = findViewById(R.id.screenShareSurface)
        
        chatAdapter = ChatAdapter(messages, "")
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = chatAdapter
        
        usersList = mutableListOf()
        usersAdapter = UsersAdapter(usersList) { user ->
            currentChat = user
            loadMessages(user.id)
            title = user.username
            callButton.isEnabled = true
            screenShareButton.isEnabled = true
        }
        usersRecyclerView.layoutManager = LinearLayoutManager(this)
        usersRecyclerView.adapter = usersAdapter
        
        findViewById<Button>(R.id.sendButton).setOnClickListener {
            val text = messageInput.text.toString()
            if (text.isNotEmpty() && currentChat != null) {
                sendMessage(text)
                messageInput.text.clear()
            }
        }
        
        callButton.setOnClickListener {
            if (isInCall) {
                endCall()
            } else {
                startCall(currentChat!!)
            }
        }
        
        screenShareButton.setOnClickListener {
            if (isScreenSharing) {
                stopScreenShare()
            } else {
                startScreenShare()
            }
        }
    }
    
    private fun checkAuth() {
        val session = sharedPrefs.getString("session", null)
        if (session != null) {
            fetchUser(session)
        } else {
            showAuthDialog()
        }
    }
    
    private fun showAuthDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_auth, null)
        val usernameInput = dialogView.findViewById<EditText>(R.id.usernameInput)
        val passwordInput = dialogView.findViewById<EditText>(R.id.passwordInput)
        val loginBtn = dialogView.findViewById<Button>(R.id.loginBtn)
        val registerBtn = dialogView.findViewById<Button>(R.id.registerBtn)
        
        val dialog = android.app.AlertDialog.Builder(this)
            .setTitle("Messenger")
            .setView(dialogView)
            .setCancelable(false)
            .create()
        
        loginBtn.setOnClickListener {
            val username = usernameInput.text.toString()
            val password = passwordInput.text.toString()
            if (username.isNotEmpty() && password.isNotEmpty()) {
                login(username, password, dialog)
            }
        }
        
        registerBtn.setOnClickListener {
            val username = usernameInput.text.toString()
            val password = passwordInput.text.toString()
            if (username.isNotEmpty() && password.isNotEmpty()) {
                register(username, password, dialog)
            }
        }
        
        dialog.show()
    }
    
    private fun login(username: String, password: String, dialog: android.app.AlertDialog) {
        Thread {
            try {
                val response = client.newCall(
                    Request.Builder()
                        .url("https://igneocxwtgnjuklerizs.supabase.co/rest/v1/rpc/login")
                        .post(RequestBody.create(MediaType.parse("application/json"), """{"username":"$username","password":"$password"}"""))
                        .addHeader("apikey", "sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .addHeader("Authorization", "Bearer sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .build()
                ).execute()
                
                if (response.isSuccessful) {
                    val data = gson.fromJson(response.body?.string(), Map::class.java)
                    val session = data["session"] as String
                    sharedPrefs.edit().putString("session", session).apply()
                    runOnUiThread {
                        dialog.dismiss()
                        fetchUser(session)
                    }
                } else {
                    runOnUiThread { Toast.makeText(this, "Ошибка входа", Toast.LENGTH_SHORT).show() }
                }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this, "Ошибка сети", Toast.LENGTH_SHORT).show() }
            }
        }.start()
    }
    
    private fun register(username: String, password: String, dialog: android.app.AlertDialog) {
        Thread {
            try {
                val salt = generateSalt()
                val hash = sha256(password + salt)
                
                val response = client.newCall(
                    Request.Builder()
                        .url("https://igneocxwtgnjuklerizs.supabase.co/rest/v1/users")
                        .post(RequestBody.create(MediaType.parse("application/json"), """{"username":"$username","password":"$hash","salt":"$salt","online":1}"""))
                        .addHeader("apikey", "sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .addHeader("Authorization", "Bearer sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .addHeader("Prefer", "return=representation")
                        .build()
                ).execute()
                
                if (response.isSuccessful) {
                    runOnUiThread {
                        dialog.dismiss()
                        login(username, password, dialog)
                    }
                } else {
                    runOnUiThread { Toast.makeText(this, "Имя занято", Toast.LENGTH_SHORT).show() }
                }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this, "Ошибка", Toast.LENGTH_SHORT).show() }
            }
        }.start()
    }
    
    private fun fetchUser(session: String) {
        Thread {
            try {
                val response = client.newCall(
                    Request.Builder()
                        .url("https://igneocxwtgnjuklerizs.supabase.co/rest/v1/users?select=*&session=eq.$session")
                        .addHeader("apikey", "sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .build()
                ).execute()
                
                if (response.isSuccessful) {
                    val usersArray = gson.fromJson(response.body?.string(), Array<User>::class.java)
                    if (usersArray.isNotEmpty()) {
                        currentUser = usersArray[0]
                        runOnUiThread {
                            initApp()
                        }
                    }
                }
            } catch (e: Exception) {}
        }.start()
    }
    
    private fun initApp() {
        connectWebSocket()
        loadUsers()
        setupRealtimeMessages()
        setupRealtimeUsers()
    }
    
    private fun connectWebSocket() {
        val session = sharedPrefs.getString("session", "")
        webSocket = object : WebSocketClient(URI("wss://igneocxwtgnjuklerizs.supabase.co/realtime/v1/websocket?apikey=sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")) {
            override fun onOpen(handshakedata: ServerHandshake?) {
                send("""{"type":"access_token","payload":{"access_token":"$session"}}""")
                send("""{"type":"subscribe","topic":"realtime:public:messages"}""")
                send("""{"type":"subscribe","topic":"realtime:public:users"}""")
            }
            
            override fun onMessage(message: String?) {
                message?.let {
                    try {
                        val data = gson.fromJson(it, Map::class.java)
                        when (data["type"]) {
                            "INSERT" -> {
                                val payload = data["payload"] as Map<*, *>
                                val record = payload["record"] as Map<*, *>
                                handleNewMessage(record)
                            }
                            "UPDATE" -> {
                                val payload = data["payload"] as Map<*, *>
                                val record = payload["record"] as Map<*, *>
                                handleUserUpdate(record)
                            }
                            else -> {
                                if (it.contains("call_offer")) handleCallOffer(it)
                                if (it.contains("call_answer")) handleCallAnswer(it)
                                if (it.contains("ice_candidate")) handleIceCandidate(it)
                                if (it.contains("screen_frame")) handleScreenFrame(it)
                            }
                        }
                    } catch (e: Exception) {}
                }
            }
            
            override fun onClose(code: Int, reason: String?, remote: Boolean) {}
            override fun onError(ex: Exception?) {}
        }
        webSocket.connect()
    }
    
    private fun handleNewMessage(record: Map<*, *>) {
        val fromId = record["from_id"] as String
        val toId = record["to_id"] as String
        val text = record["text"] as String
        val time = (record["time"] as Double).toLong()
        
        if (fromId == currentUser?.id || toId == currentUser?.id) {
            val msg = Message(record["id"].toString(), fromId, toId, text, time, "text")
            messages.add(msg)
            runOnUiThread {
                chatAdapter.updateMessages(messages, currentUser?.id ?: "")
                messagesRecyclerView.scrollToPosition(messages.size - 1)
            }
        }
    }
    
    private fun handleUserUpdate(record: Map<*, *>) {
        val userId = record["id"] as String
        val online = (record["online"] as? Double)?.toInt() ?: 0
        val inCall = (record["in_call"] as? Double)?.toInt() ?: 0
        
        runOnUiThread {
            val user = usersList.find { it.id == userId }
            user?.let {
                it.online = online == 1
                it.inCall = inCall == 1
                usersAdapter.notifyDataSetChanged()
            }
        }
    }
    
    private fun setupRealtimeMessages() {
        Thread {
            try {
                val response = client.newCall(
                    Request.Builder()
                        .url("https://igneocxwtgnjuklerizs.supabase.co/rest/v1/messages?select=*&order=time.asc")
                        .addHeader("apikey", "sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .build()
                ).execute()
                
                if (response.isSuccessful) {
                    val msgs = gson.fromJson(response.body?.string(), Array<Message>::class.java)
                    messages.clear()
                    messages.addAll(msgs.filter { 
                        it.fromId == currentUser?.id || it.toId == currentUser?.id 
                    })
                    runOnUiThread {
                        chatAdapter.updateMessages(messages, currentUser?.id ?: "")
                    }
                }
            } catch (e: Exception) {}
        }.start()
    }
    
    private fun setupRealtimeUsers() {
        loadUsers()
    }
    
    private fun loadUsers() {
        Thread {
            try {
                val response = client.newCall(
                    Request.Builder()
                        .url("https://igneocxwtgnjuklerizs.supabase.co/rest/v1/users?select=id,username,online,in_call&neq=id.${currentUser?.id}")
                        .addHeader("apikey", "sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                        .build()
                ).execute()
                
                if (response.isSuccessful) {
                    val users = gson.fromJson(response.body?.string(), Array<User>::class.java)
                    usersList.clear()
                    usersList.addAll(users)
                    runOnUiThread {
                        usersAdapter.notifyDataSetChanged()
                    }
                }
            } catch (e: Exception) {}
        }.start()
    }
    
    private fun loadMessages(userId: String) {
        val filtered = messages.filter { 
            (it.fromId == currentUser?.id && it.toId == userId) || 
            (it.fromId == userId && it.toId == currentUser?.id)
        }
        runOnUiThread {
            chatAdapter.updateMessages(filtered, currentUser?.id ?: "")
        }
    }
    
    private fun sendMessage(text: String) {
        currentChat?.let { chat ->
            Thread {
                try {
                    client.newCall(
                        Request.Builder()
                            .url("https://igneocxwtgnjuklerizs.supabase.co/rest/v1/messages")
                            .post(RequestBody.create(MediaType.parse("application/json"), 
                                """{"from_id":"${currentUser?.id}","to_id":"${chat.id}","text":"$text","time":${System.currentTimeMillis()}}"""))
                            .addHeader("apikey", "sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                            .addHeader("Authorization", "Bearer sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-")
                            .build()
                    ).execute()
                } catch (e: Exception) {}
            }.start()
        }
    }
    
    private fun startCall(user: User) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO_PERMISSION)
            return
        }
        
        isInCall = true
        currentCallWith = user.id
        callButton.setImageResource(android.R.drawable.ic_menu_call)
        Toast.makeText(this, "Звонок ${user.username}...", Toast.LENGTH_SHORT).show()
        
        webSocket.send(gson.toJson(mapOf(
            "type" to "call_offer",
            "to" to user.id,
            "from" to currentUser?.id,
            "fromName" to currentUser?.username
        )))
        
        startAudioStream()
    }
    
    private fun answerCall(from: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        
        isInCall = true
        currentCallWith = from
        callButton.setImageResource(android.R.drawable.ic_menu_call)
        
        webSocket.send(gson.toJson(mapOf(
            "type" to "call_answer",
            "to" to from,
            "from" to currentUser?.id
        )))
        
        startAudioStream()
    }
    
    private fun endCall() {
        isInCall = false
        stopAudioStream()
        currentCallWith = null
        callButton.setImageResource(android.R.drawable.ic_menu_call)
        Toast.makeText(this, "Звонок завершен", Toast.LENGTH_SHORT).show()
        
        webSocket.send(gson.toJson(mapOf(
            "type" to "call_end",
            "to" to currentCallWith
        )))
    }
    
    private fun startAudioStream() {
        val port = 12345
        udpSocket = DatagramSocket(port)
        
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            16000,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            audioBufferSize
        )
        
        audioTrack = AudioTrack(
            android.media.AudioManager.STREAM_VOICE_CALL,
            16000,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            audioBufferSize,
            AudioTrack.MODE_STREAM
        )
        
        isRecording = true
        audioRecord?.startRecording()
        audioTrack?.play()
        
        Thread {
            val buffer = ByteArray(audioBufferSize)
            while (isRecording) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (read > 0) {
                    audioTrack?.write(buffer, 0, read)
                    
                    currentCallWith?.let { target ->
                        try {
                            val packet = DatagramPacket(buffer, read, targetAddress ?: InetAddress.getByName("255.255.255.255"), 12345)
                            udpSocket?.send(packet)
                        } catch (e: Exception) {}
                    }
                }
            }
        }.start()
        
        Thread {
            val receiveBuffer = ByteArray(audioBufferSize)
            while (isRecording) {
                val packet = DatagramPacket(receiveBuffer, receiveBuffer.size)
                try {
                    udpSocket?.receive(packet)
                    audioTrack?.write(packet.data, 0, packet.length)
                } catch (e: Exception) {}
            }
        }.start()
    }
    
    private fun stopAudioStream() {
        isRecording = false
        audioRecord?.stop()
        audioTrack?.stop()
        audioRecord?.release()
        audioTrack?.release()
        udpSocket?.close()
    }
    
    private fun startScreenShare() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            startActivityForResult(
                mediaProjectionManager?.createScreenCaptureIntent(),
                REQUEST_CODE_SCREEN_CAPTURE
            )
        }
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == REQUEST_CODE_SCREEN_CAPTURE && resultCode == RESULT_OK && data != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
                setupVirtualDisplay()
                isScreenSharing = true
                screenShareButton.setImageResource(android.R.drawable.ic_menu_camera)
                Toast.makeText(this, "Трансляция экрана начата", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun setupVirtualDisplay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val metrics = resources.displayMetrics
            val width = metrics.widthPixels
            val height = metrics.heightPixels
            val density = metrics.densityDpi
            
            surfaceView?.let { view ->
                virtualDisplay = mediaProjection?.createVirtualDisplay(
                    "ScreenShare",
                    width, height, density,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    view.holder.surface,
                    null, null
                )
                
                startScreenCapture()
            }
        }
    }
    
    private fun startScreenCapture() {
        Thread {
            val buffer = ByteArray(1024 * 1024)
            while (isScreenSharing) {
                try {
                    surfaceView?.let { view ->
                        view.isDrawingCacheEnabled = true
                        val bitmap = view.drawingCache
                        val stream = ByteArrayOutputStream()
                        bitmap?.compress(Bitmap.CompressFormat.JPEG, 50, stream)
                        val data = Base64.encodeToString(stream.toByteArray(), Base64.DEFAULT)
                        
                        currentCallWith?.let { target ->
                            webSocket.send(gson.toJson(mapOf(
                                "type" to "screen_frame",
                                "to" to target,
                                "data" to data,
                                "width" to bitmap?.width,
                                "height" to bitmap?.height
                            )))
                        }
                    }
                    Thread.sleep(100)
                } catch (e: Exception) {}
            }
        }.start()
    }
    
    private fun stopScreenShare() {
        isScreenSharing = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            virtualDisplay?.release()
            mediaProjection?.stop()
        }
        screenShareButton.setImageResource(android.R.drawable.ic_menu_camera)
        Toast.makeText(this, "Трансляция экрана остановлена", Toast.LENGTH_SHORT).show()
    }
    
    private fun handleScreenFrame(data: String) {
        val frame = gson.fromJson(data, ScreenShareFrame::class.java)
        runOnUiThread {
            surfaceView?.let { view ->
                val bytes = Base64.decode(frame.data, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                view.holder.surface?.let { surface ->
                    val canvas = surface.lockCanvas(null)
                    canvas.drawBitmap(bitmap, 0f, 0f, null)
                    surface.unlockCanvasAndPost(canvas)
                }
            }
        }
    }
    
    private fun handleCallOffer(data: String) {
        val offer = gson.fromJson(data, CallOffer::class.java)
        runOnUiThread {
            android.app.AlertDialog.Builder(this)
                .setTitle("Входящий звонок")
                .setMessage("${offer.fromName} звонит вам")
                .setPositiveButton("Ответить") { _, _ ->
                    answerCall(offer.from)
                }
                .setNegativeButton("Отклонить") { _, _ -> }
                .show()
        }
    }
    
    private fun handleCallAnswer(data: String) {
        Toast.makeText(this, "Звонок принят", Toast.LENGTH_SHORT).show()
    }
    
    private fun handleIceCandidate(data: String) {}
    
    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
    
    private fun generateSalt(): String = java.util.UUID.randomUUID().toString()
    
    override fun onDestroy() {
        super.onDestroy()
        if (isInCall) endCall()
        if (isScreenSharing) stopScreenShare()
        webSocket.close()
    }
}

class ChatAdapter(private var messages: List<Message>, private var currentUserId: String) :
    RecyclerView.Adapter<ChatAdapter.ViewHolder>() {
    
    class ViewHolder(val view: android.view.View) : RecyclerView.ViewHolder(view) {
        val messageText: TextView = view.findViewById(R.id.messageText)
        val messageTime: TextView = view.findViewById(R.id.messageTime)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val msg = messages[position]
        holder.messageText.text = msg.text
        holder.messageTime.text = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date(msg.time))
        
        val isSent = msg.fromId == currentUserId
        holder.messageText.setBackgroundResource(
            if (isSent) R.drawable.bg_message_sent else R.drawable.bg_message_received
        )
        val params = holder.messageText.layoutParams as LinearLayout.LayoutParams
        params.gravity = if (isSent) Gravity.END else Gravity.START
        holder.messageText.layoutParams = params
    }
    
    override fun getItemCount() = messages.size
    
    fun updateMessages(newMessages: List<Message>, newCurrentUserId: String) {
        messages = newMessages
        currentUserId = newCurrentUserId
        notifyDataSetChanged()
    }
}

class UsersAdapter(private val users: List<User>, private val onUserClick: (User) -> Unit) :
    RecyclerView.Adapter<UsersAdapter.ViewHolder>() {
    
    class ViewHolder(val view: android.view.View) : RecyclerView.ViewHolder(view) {
        val username: TextView = view.findViewById(R.id.usernameText)
        val status: TextView = view.findViewById(R.id.statusText)
        val statusDot: View = view.findViewById(R.id.statusDot)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_user, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val user = users[position]
        holder.username.text = user.username
        holder.status.text = when {
            user.inCall -> "в звонке"
            user.online -> "онлайн"
            else -> "офлайн"
        }
        holder.statusDot.setBackgroundColor(
            when {
                user.inCall -> android.graphics.Color.parseColor("#f59e0b")
                user.online -> android.graphics.Color.parseColor("#4ade80")
                else -> android.graphics.Color.parseColor("#6b7280")
            }
        )
        holder.view.setOnClickListener { onUserClick(user) }
    }
    
    override fun getItemCount() = users.size
}