import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

const supabase = createClient(
  'https://igneocxwtgnjuklerizs.supabase.co',
  'sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-'
);

export default function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (user) {
      loadUsers();
      setupRealtime();
    }
  }, [user]);

  useEffect(() => {
    if (currentChat) {
      loadMessages();
    }
  }, [currentChat]);

  async function checkSession() {
    const session = await AsyncStorage.getItem('session');
    if (session) {
      const { data } = await supabase.from('users').select('*').eq('session', session).single();
      if (data) {
        setUser(data);
        await supabase.from('users').update({ online: 1 }).eq('id', data.id);
      }
    }
  }

  async function sha256(message) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      message
    );
    return digest;
  }

  async function handleAuth() {
    if (!authUsername.trim() || !authPassword.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    
    setLoading(true);
    try {
      if (isLogin) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('username', authUsername.trim())
          .single();
          
        if (!existingUser) {
          Alert.alert('Ошибка', 'Пользователь не найден');
          return;
        }
        
        const hash = await sha256(authPassword + existingUser.salt);
        if (hash !== existingUser.password) {
          Alert.alert('Ошибка', 'Неверный пароль');
          return;
        }
        
        const session = Math.random().toString(36) + Date.now();
        await supabase.from('users').update({ session, online: 1 }).eq('id', existingUser.id);
        await AsyncStorage.setItem('session', session);
        setUser({ ...existingUser, session });
      } else {
        const salt = Math.random().toString(36);
        const hash = await sha256(authPassword + salt);
        
        const { data: newUser, error } = await supabase
          .from('users')
          .insert({
            username: authUsername.trim(),
            password: hash,
            salt,
            session: Math.random().toString(36) + Date.now(),
            online: 1
          })
          .select()
          .single();
        
        if (error) {
          Alert.alert('Ошибка', 'Имя пользователя занято');
          return;
        }
        
        await AsyncStorage.setItem('session', newUser.session);
        setUser(newUser);
      }
    } catch (err) {
      Alert.alert('Ошибка', 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, username, online')
      .neq('id', user.id);
    setUsers(data || []);
  }

  function setupRealtime() {
    supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new;
        if (msg.to_id === user.id || msg.from_id === user.id) {
          if (currentChat && (msg.from_id === currentChat.id || msg.to_id === currentChat.id)) {
            setMessages(prev => [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
          }
        }
      })
      .subscribe();
      
    supabase
      .channel('users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, payload => {
        const updatedUser = payload.new;
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, online: updatedUser.online } : u));
        if (currentChat && currentChat.id === updatedUser.id) {
          setCurrentChat(prev => ({ ...prev, online: updatedUser.online }));
        }
      })
      .subscribe();
  }

  async function sendMessage() {
    if (!messageText.trim() || !currentChat) return;
    
    await supabase.from('messages').insert({
      from_id: user.id,
      to_id: currentChat.id,
      text: messageText.trim(),
      time: Date.now()
    });
    
    setMessageText('');
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
      .or(`from_id.eq.${currentChat.id},to_id.eq.${currentChat.id}`)
      .order('time', { ascending: true });
    
    setMessages(data || []);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <View style={styles.authBox}>
          <Text style={styles.authTitle}>{isLogin ? 'Вход' : 'Регистрация'}</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Имя пользователя" 
            placeholderTextColor="#888" 
            value={authUsername} 
            onChangeText={setAuthUsername} 
          />
          <TextInput 
            style={styles.input} 
            placeholder="Пароль" 
            placeholderTextColor="#888" 
            value={authPassword} 
            onChangeText={setAuthPassword} 
            secureTextEntry 
          />
          <TouchableOpacity style={styles.authButton} onPress={handleAuth} disabled={loading}>
            <Text style={styles.authButtonText}>{loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.switchText}>{isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.sidebar}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text></View>
          <View><Text style={styles.username}>{user.username}</Text><Text style={styles.status}>онлайн</Text></View>
        </View>
        <FlatList 
          data={users} 
          keyExtractor={item => item.id} 
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.userItem, currentChat?.id === item.id && styles.activeUser]} onPress={() => setCurrentChat(item)}>
              <View style={styles.userAvatar}><Text style={styles.userAvatarText}>{item.username[0].toUpperCase()}</Text></View>
              <View style={styles.userInfoText}>
                <Text style={styles.userName}>{item.username}</Text>
                <Text style={styles.userStatus}>{item.online ? 'онлайн' : 'офлайн'}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: item.online ? '#4ade80' : '#6b7280' }]} />
            </TouchableOpacity>
          )}
        />
      </View>
      {currentChat ? (
        <View style={styles.chatArea}>
          <View style={styles.chatHeader}>
            <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>{currentChat.username[0].toUpperCase()}</Text></View>
            <View><Text style={styles.chatName}>{currentChat.username}</Text><Text style={styles.chatStatus}>{currentChat.online ? 'онлайн' : 'офлайн'}</Text></View>
          </View>
          <FlatList 
            ref={flatListRef}
            data={messages} 
            keyExtractor={item => item.id.toString()} 
            style={styles.messagesList} 
            renderItem={({ item }) => (
              <View style={[styles.message, item.from_id === user.id ? styles.sentMessage : styles.receivedMessage]}>
                <Text style={item.from_id === user.id ? styles.sentText : styles.receivedText}>{item.text}</Text>
                <Text style={styles.messageTime}>{new Date(item.time).toLocaleTimeString()}</Text>
              </View>
            )}
          />
          <View style={styles.inputArea}>
            <TextInput 
              style={styles.messageInput} 
              placeholder="Сообщение..." 
              placeholderTextColor="#888" 
              value={messageText} 
              onChangeText={setMessageText} 
              multiline 
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyChat}><Text style={styles.emptyText}>Выберите чат</Text></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#1a1a1a' },
  authContainer: { flex: 1, justifyContent: 'center', backgroundColor: '#1a1a1a' },
  authBox: { backgroundColor: '#2d2d2d', margin: 20, padding: 20, borderRadius: 20 },
  authTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: 'white' },
  input: { borderWidth: 1, borderColor: '#404040', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16, backgroundColor: '#3d3d3d', color: 'white' },
  authButton: { backgroundColor: '#667eea', padding: 15, borderRadius: 8, alignItems: 'center' },
  authButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  switchText: { textAlign: 'center', marginTop: 20, color: '#667eea' },
  sidebar: { width: 300, backgroundColor: '#2d2d2d' },
  userInfo: { padding: 20, backgroundColor: '#252525', flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#404040' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  username: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  status: { color: '#4ade80', fontSize: 12 },
  userItem: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#404040' },
  activeUser: { backgroundColor: '#667eea' },
  userAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  userInfoText: { flex: 1 },
  userName: { color: 'white', fontSize: 16, fontWeight: '600' },
  userStatus: { color: '#888', fontSize: 11 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  chatArea: { flex: 1, backgroundColor: '#1a1a1a' },
  chatHeader: { padding: 20, backgroundColor: '#2d2d2d', flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderBottomColor: '#404040' },
  chatAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  chatAvatarText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  chatName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  chatStatus: { color: '#888', fontSize: 12 },
  messagesList: { flex: 1, padding: 20 },
  message: { maxWidth: '70%', padding: 10, borderRadius: 15, marginBottom: 10 },
  sentMessage: { alignSelf: 'flex-end', backgroundColor: '#667eea' },
  receivedMessage: { alignSelf: 'flex-start', backgroundColor: '#2d2d2d' },
  sentText: { color: 'white' },
  receivedText: { color: 'white' },
  messageTime: { fontSize: 10, opacity: 0.7, marginTop: 5 },
  inputArea: { flexDirection: 'row', padding: 15, backgroundColor: '#2d2d2d', borderTopWidth: 1, borderTopColor: '#404040', alignItems: 'center', gap: 10 },
  messageInput: { flex: 1, backgroundColor: '#3d3d3d', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, color: 'white', maxHeight: 100 },
  sendButton: { width: 40, height: 40, backgroundColor: '#667eea', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: 'white', fontSize: 20 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 }
});