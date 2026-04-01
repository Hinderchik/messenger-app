package com.hinderchik.messenger

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
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
import okhttp3.*
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.text.SimpleDateFormat
import java.util.*
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible

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
    private val usersList = mutableListOf<User>()
    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var usersRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var callButton: ImageButton
    private lateinit var screenShareButton: ImageButton
    private lateinit var sendButton: Button
    private lateinit var screenShareSurface: SurfaceView
    
    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var isInCall = false
    private var currentCallWith: String? = null
    private var audioRecord: android.media.AudioRecord? = null
    private var audioTrack: android.media.AudioTrack? = null
    private var isRecording = false
    private var udpSocket: DatagramSocket? = null
    private var targetAddress: InetAddress? = null
    private val audioBufferSize = android.media.AudioRecord.getMinBufferSize(16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT)
    
    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
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
        setupUI()
        loadDemoData()
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
        sendButton = findViewById(R.id.sendButton)
        callButton = findViewById(R.id.callButton)
        screenShareButton = findViewById(R.id.screenShareButton)
        screenShareSurface = findViewById(R.id.screenShareSurface)
        
        chatAdapter = ChatAdapter(messages, "")
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = chatAdapter
        
        usersAdapter = UsersAdapter(usersList) { user ->
            currentChat = user
            title = user.username
            callButton.isEnabled = true
            screenShareButton.isEnabled = true
        }
        usersRecyclerView.layoutManager = LinearLayoutManager(this)
        usersRecyclerView.adapter = usersAdapter
        
        sendButton.setOnClickListener {
            val text = messageInput.text.toString()
            if (text.isNotEmpty() && currentChat != null) {
                val msg = Message(
                    id = System.currentTimeMillis().toString(),
                    fromId = currentUser?.id ?: "1",
                    toId = currentChat!!.id,
                    text = text,
                    time = System.currentTimeMillis()
                )
                messages.add(msg)
                chatAdapter.updateMessages(messages, currentUser?.id ?: "")
                messagesRecyclerView.scrollToPosition(messages.size - 1)
                messageInput.text.clear()
            }
        }
        
        callButton.setOnClickListener {
            Toast.makeText(this, "Звонок ${currentChat?.username}", Toast.LENGTH_SHORT).show()
        }
        
        screenShareButton.setOnClickListener {
            Toast.makeText(this, "Демонстрация экрана", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun loadDemoData() {
        currentUser = User("1", "You", true, false)
        usersList.add(User("2", "Alice", true, false))
        usersList.add(User("3", "Bob", false, false))
        usersList.add(User("4", "Charlie", true, true))
        usersAdapter.notifyDataSetChanged()
        
        messages.add(Message("1", "2", "1", "Привет!", System.currentTimeMillis() - 60000))
        messages.add(Message("2", "1", "2", "Здравствуй!", System.currentTimeMillis() - 50000))
        chatAdapter.updateMessages(messages, "1")
    }
}

class ChatAdapter(private var messages: List<Message>, private var currentUserId: String) :
    RecyclerView.Adapter<ChatAdapter.ViewHolder>() {
    
    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val messageText: TextView = itemView.findViewById(R.id.messageText)
        val messageTime: TextView = itemView.findViewById(R.id.messageTime)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val msg = messages[position]
        holder.messageText.text = msg.text
        holder.messageTime.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(msg.time))
        
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
    
    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val username: TextView = itemView.findViewById(R.id.usernameText)
        val status: TextView = itemView.findViewById(R.id.statusText)
        val statusDot: View = itemView.findViewById(R.id.statusDot)
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
        holder.itemView.setOnClickListener { onUserClick(user) }
    }
    
    override fun getItemCount() = users.size
}
