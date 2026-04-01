package com.hinderchik.messenger
import com.hinderchik.messenger.R

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
import java.text.SimpleDateFormat
import java.util.*

data class User(val id: String, val username: String, var online: Boolean = false, var inCall: Boolean = false)
data class Message(val id: String, val fromId: String, val toId: String, val text: String, val time: Long)

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
    private lateinit var sendButton: Button
    private lateinit var callButton: ImageButton
    private lateinit var screenShareButton: ImageButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        messagesRecyclerView = findViewById(R.id.messagesRecyclerView)
        usersRecyclerView = findViewById(R.id.usersRecyclerView)
        messageInput = findViewById(R.id.messageInput)
        sendButton = findViewById(R.id.sendButton)
        callButton = findViewById(R.id.callButton)
        screenShareButton = findViewById(R.id.screenShareButton)
        
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
        
        loadDemoData()
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
