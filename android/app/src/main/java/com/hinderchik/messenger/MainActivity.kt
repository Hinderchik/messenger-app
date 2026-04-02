package com.hinderchik.messenger

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.view.Gravity
import android.graphics.drawable.GradientDrawable
import android.graphics.Color
import android.view.animation.AnimationUtils
import android.view.inputmethod.EditorInfo
import android.text.format.DateUtils
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

data class User(
    val id: String, 
    val username: String, 
    var online: Boolean = false,
    var lastSeen: Long = 0,
    var avatarColor: Int = 0
)

data class Message(
    val id: String, 
    val fromId: String, 
    val toId: String, 
    val text: String, 
    val time: Long, 
    val isRead: Boolean = true
)

class MainActivity : AppCompatActivity() {
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var usersAdapter: UsersAdapter
    private val messages = mutableListOf<Message>()
    private val usersList = mutableListOf<User>()
    private var currentUser: User? = null
    private var currentChat: User? = null
    
    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var usersRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var callButton: ImageButton
    private lateinit var screenShareButton: ImageButton
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var emptyStateView: TextView
    private lateinit var chatTitle: TextView
    private lateinit var chatStatus: TextView
    
    private val client = OkHttpClient()
    private val prefs by lazy { getSharedPreferences("messenger", MODE_PRIVATE) }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        setupViews()
        setupClickListeners()
        checkAuth()
    }
    
    private fun setupViews() {
        messagesRecyclerView = findViewById(R.id.messagesRecyclerView)
        usersRecyclerView = findViewById(R.id.usersRecyclerView)
        messageInput = findViewById(R.id.messageInput)
        sendButton = findViewById(R.id.sendButton)
        callButton = findViewById(R.id.callButton)
        screenShareButton = findViewById(R.id.screenShareButton)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        emptyStateView = findViewById(R.id.emptyStateView)
        chatTitle = findViewById(R.id.chatTitle)
        chatStatus = findViewById(R.id.chatStatus)
        
        chatAdapter = ChatAdapter(messages, "")
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = chatAdapter
        
        usersAdapter = UsersAdapter(usersList) { user ->
            currentChat = user
            chatTitle.text = user.username
            updateChatStatus()
            loadMessages(user.id)
            messageInput.isEnabled = true
            sendButton.isEnabled = true
            callButton.isEnabled = true
            screenShareButton.isEnabled = true
            emptyStateView.visibility = View.GONE
        }
        usersRecyclerView.layoutManager = LinearLayoutManager(this)
        usersRecyclerView.adapter = usersAdapter
        
        swipeRefresh.setOnRefreshListener {
            loadUsers()
            if (currentChat != null) loadMessages(currentChat!!.id)
        }
        
        messageInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendMessage()
                true
            } else false
        }
    }
    
    private fun setupClickListeners() {
        sendButton.setOnClickListener { sendMessage() }
        
        callButton.setOnClickListener {
            currentChat?.let { chat ->
                Snackbar.make(findViewById(android.R.id.content), "📞 Звонок ${chat.username}...", Snackbar.LENGTH_SHORT).show()
            }
        }
        
        screenShareButton.setOnClickListener {
            Snackbar.make(findViewById(android.R.id.content), "📺 Демонстрация экрана", Snackbar.LENGTH_SHORT).show()
        }
    }
    
    private fun checkAuth() {
        val userId = prefs.getString("userId", null)
        if (userId != null) {
            currentUser = User(userId, prefs.getString("username", "User") ?: "User", true)
            initApp()
        } else {
            showAuthDialog()
        }
    }
    
    private fun showAuthDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_auth, null)
        val usernameInput = dialogView.findViewById<EditText>(R.id.usernameInput)
        val passwordInput = dialogView.findViewById<EditText>(R.id.passwordInput)
        
        MaterialAlertDialogBuilder(this)
            .setTitle("✨ Messenger")
            .setView(dialogView)
            .setPositiveButton("Войти") { _, _ ->
                val username = usernameInput.text.toString().trim()
                val password = passwordInput.text.toString()
                if (username.isNotEmpty() && password.isNotEmpty()) {
                    login(username, password)
                }
            }
            .setNegativeButton("Регистрация") { _, _ ->
                val username = usernameInput.text.toString().trim()
                val password = passwordInput.text.toString()
                if (username.isNotEmpty() && password.isNotEmpty()) {
                    register(username, password)
                }
            }
            .setCancelable(false)
            .show()
    }
    
    private fun login(username: String, password: String) {
        val user = usersList.find { it.username.equals(username, ignoreCase = true) }
        if (user != null && password == "123") {
            currentUser = user
            prefs.edit().putString("userId", user.id).putString("username", user.username).apply()
            initApp()
        } else {
            Snackbar.make(findViewById(android.R.id.content), "❌ Неверный логин или пароль", Snackbar.LENGTH_SHORT).show()
            showAuthDialog()
        }
    }
    
    private fun register(username: String, password: String) {
        if (usersList.any { it.username.equals(username, ignoreCase = true) }) {
            Snackbar.make(findViewById(android.R.id.content), "❌ Пользователь уже существует", Snackbar.LENGTH_SHORT).show()
            showAuthDialog()
            return
        }
        
        val newUser = User(
            id = (usersList.size + 2).toString(),
            username = username,
            online = true,
            avatarColor = generateAvatarColor(username)
        )
        usersList.add(newUser)
        currentUser = newUser
        prefs.edit().putString("userId", newUser.id).putString("username", newUser.username).apply()
        initApp()
    }
    
    private fun generateAvatarColor(username: String): Int {
        val colors = listOf(
            Color.parseColor("#FF6B6B"), Color.parseColor("#4ECDC4"),
            Color.parseColor("#45B7D1"), Color.parseColor("#96CEB4"),
            Color.parseColor("#FFEAA7"), Color.parseColor("#DDA0DD")
        )
        return colors[username.length % colors.size]
    }
    
    private fun initApp() {
        loadUsers()
        setupDemoMessages()
        updateChatStatus()
    }
    
    private fun loadUsers() {
        if (usersList.isEmpty()) {
            usersList.addAll(listOf(
                User("1", "Алексей", true, System.currentTimeMillis() - 1000, generateAvatarColor("Алексей")),
                User("2", "Мария", true, System.currentTimeMillis() - 5000, generateAvatarColor("Мария")),
                User("3", "Дмитрий", false, System.currentTimeMillis() - 3600000, generateAvatarColor("Дмитрий")),
                User("4", "Екатерина", true, System.currentTimeMillis() - 10000, generateAvatarColor("Екатерина")),
                User("5", "Сергей", false, System.currentTimeMillis() - 7200000, generateAvatarColor("Сергей"))
            ))
        }
        usersAdapter.notifyDataSetChanged()
        swipeRefresh.isRefreshing = false
    }
    
    private fun setupDemoMessages() {
        if (messages.isEmpty()) {
            messages.addAll(listOf(
                Message("1", "1", currentUser?.id ?: "0", "Привет! Как дела?", System.currentTimeMillis() - 3600000),
                Message("2", currentUser?.id ?: "0", "1", "Отлично! А у тебя?", System.currentTimeMillis() - 3500000),
                Message("3", "1", currentUser?.id ?: "0", "Тоже хорошо 😊", System.currentTimeMillis() - 3400000)
            ))
        }
    }
    
    private fun loadMessages(userId: String) {
        val filtered = messages.filter { 
            (it.fromId == currentUser?.id && it.toId == userId) ||
            (it.fromId == userId && it.toId == currentUser?.id)
        }.sortedBy { it.time }
        
        chatAdapter.updateMessages(filtered, currentUser?.id ?: "")
        messagesRecyclerView.scrollToPosition(filtered.size - 1)
    }
    
    private fun sendMessage() {
        val text = messageInput.text.toString().trim()
        if (text.isEmpty() || currentChat == null) return
        
        val newMessage = Message(
            id = System.currentTimeMillis().toString(),
            fromId = currentUser?.id ?: "0",
            toId = currentChat!!.id,
            text = text,
            time = System.currentTimeMillis()
        )
        
        messages.add(newMessage)
        chatAdapter.updateMessages(messages.filter { 
            (it.fromId == currentUser?.id && it.toId == currentChat?.id) ||
            (it.fromId == currentChat?.id && it.toId == currentUser?.id)
        }.sortedBy { it.time }, currentUser?.id ?: "")
        
        messageInput.text.clear()
        messagesRecyclerView.scrollToPosition(chatAdapter.itemCount - 1)
        
        // Имитация ответа
        if (text.contains("?")) {
            Handler(mainLooper).postDelayed({
                val reply = Message(
                    id = System.currentTimeMillis().toString(),
                    fromId = currentChat!!.id,
                    toId = currentUser?.id ?: "0",
                    text = getAutoReply(text),
                    time = System.currentTimeMillis()
                )
                messages.add(reply)
                chatAdapter.updateMessages(messages.filter { 
                    (it.fromId == currentUser?.id && it.toId == currentChat?.id) ||
                    (it.fromId == currentChat?.id && it.toId == currentUser?.id)
                }.sortedBy { it.time }, currentUser?.id ?: "")
                messagesRecyclerView.scrollToPosition(chatAdapter.itemCount - 1)
            }, 1500)
        }
    }
    
    private fun getAutoReply(text: String): String {
        return when {
            text.contains("привет", ignoreCase = true) -> "Привет! 👋"
            text.contains("как дела", ignoreCase = true) -> "Хорошо, спасибо! А у тебя? 😊"
            text.contains("пока", ignoreCase = true) -> "Пока! Было приятно пообщаться 👋"
            text.contains("спасибо", ignoreCase = true) -> "Всегда пожалуйста! 🙏"
            else -> "Понял, спасибо за сообщение!"
        }
    }
    
    private fun updateChatStatus() {
        currentChat?.let { chat ->
            chatStatus.text = when {
                chat.online -> "● В сети"
                else -> {
                    val timeAgo = DateUtils.getRelativeTimeSpanString(chat.lastSeen, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)
                    "Был $timeAgo"
                }
            }
            chatStatus.setTextColor(if (chat.online) Color.parseColor("#4ade80") else Color.parseColor("#888888"))
        }
    }
}

class ChatAdapter(private var messages: List<Message>, private var currentUserId: String) :
    RecyclerView.Adapter<ChatAdapter.MessageViewHolder>() {
    
    private val animation = AnimationUtils.loadAnimation(
        RecyclerView::class.java.getDeclaredField("context").let { 
            it.isAccessible = true
            it.get(RecyclerView::class.java) as android.content.Context
        } ?: throw IllegalStateException(),
        android.R.anim.fade_in
    )
    
    class MessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val messageBubble: View = itemView.findViewById(R.id.messageBubble)
        val messageText: TextView = itemView.findViewById(R.id.messageText)
        val messageTime: TextView = itemView.findViewById(R.id.messageTime)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message, parent, false)
        return MessageViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        val msg = messages[position]
        val isSent = msg.fromId == currentUserId
        
        holder.messageText.text = msg.text
        holder.messageTime.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(msg.time))
        
        val layoutParams = holder.messageBubble.layoutParams as LinearLayout.LayoutParams
        layoutParams.gravity = if (isSent) Gravity.END else Gravity.START
        holder.messageBubble.layoutParams = layoutParams
        
        val drawable = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 20f
            setColor(if (isSent) Color.parseColor("#667eea") else Color.parseColor("#2d2d2d"))
        }
        holder.messageBubble.background = drawable
        
        holder.itemView.startAnimation(animation)
    }
    
    override fun getItemCount() = messages.size
    
    fun updateMessages(newMessages: List<Message>, newCurrentUserId: String) {
        messages = newMessages
        currentUserId = newCurrentUserId
        notifyDataSetChanged()
    }
}

class UsersAdapter(private val users: List<User>, private val onUserClick: (User) -> Unit) :
    RecyclerView.Adapter<UsersAdapter.UserViewHolder>() {
    
    class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val avatar: TextView = itemView.findViewById(R.id.avatar)
        val username: TextView = itemView.findViewById(R.id.usernameText)
        val status: TextView = itemView.findViewById(R.id.statusText)
        val statusDot: View = itemView.findViewById(R.id.statusDot)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_user, parent, false)
        return UserViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        val user = users[position]
        
        holder.avatar.text = user.username.take(1).uppercase()
        holder.avatar.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(user.avatarColor)
        }
        
        holder.username.text = user.username
        holder.status.text = when {
            user.online -> "В сети"
            else -> {
                val timeAgo = DateUtils.getRelativeTimeSpanString(user.lastSeen, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)
                "Был $timeAgo"
            }
        }
        holder.statusDot.setBackgroundColor(if (user.online) Color.parseColor("#4ade80") else Color.parseColor("#6b7280"))
        
        holder.itemView.setOnClickListener { onUserClick(user) }
    }
    
    override fun getItemCount() = users.size
}