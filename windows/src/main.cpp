#include <windows.h>
#include <string>
#include <vector>
#include <map>
#include <thread>
#include <mutex>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <websocketpp/config/asio_no_tls_client.hpp>
#include <websocketpp/client.hpp>
#include <nlohmann/json.hpp>
#include <cpprest/http_client.h>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(linker,"\"/manifestdependency:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")

using namespace std;
using json = nlohmann::json;
using ws_client = websocketpp::client<websocketpp::config::asio_client>;

#define ID_EDIT_MESSAGE 1001
#define ID_BUTTON_SEND 1002
#define ID_LIST_USERS 1003
#define ID_LIST_MESSAGES 1004
#define ID_BUTTON_CALL 1005
#define ID_BUTTON_SCREEN 1006
#define ID_EDIT_USERNAME 1007
#define ID_EDIT_PASSWORD 1008
#define ID_BUTTON_LOGIN 1009
#define ID_BUTTON_REGISTER 1010
#define ID_STATIC_STATUS 1011

HINSTANCE hInst;
HWND hMainWnd;
HWND hEditMessage;
HWND hListUsers;
HWND hListMessages;
HWND hButtonSend;
HWND hButtonCall;
HWND hButtonScreen;
HWND hStaticStatus;

string current_user_id;
string current_username;
string current_chat_id;
string current_chat_name;
string session_token;
map<string, string> users;
vector<tuple<string, string, string, long long, string>> messages;
mutex messages_mtx;
mutex users_mtx;
bool is_in_call = false;
ws_client* websocket = nullptr;
websocketpp::connection_hdl ws_hdl;

string sha256(const string& input) {
    HCRYPTPROV hProv = 0;
    HCRYPTHASH hHash = 0;
    BYTE rgbHash[32];
    DWORD cbHash = 32;
    
    CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT);
    CryptCreateHash(hProv, CALG_SHA_256, 0, 0, &hHash);
    CryptHashData(hHash, (BYTE*)input.c_str(), input.length(), 0);
    CryptGetHashParam(hHash, HP_HASHVAL, rgbHash, &cbHash, 0);
    
    CryptDestroyHash(hHash);
    CryptReleaseContext(hProv, 0);
    
    stringstream ss;
    for (int i = 0; i < 32; i++) ss << hex << setw(2) << setfill('0') << (int)rgbHash[i];
    return ss.str();
}

string generate_salt() {
    string chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    string salt;
    for (int i = 0; i < 16; i++) salt += chars[rand() % 36];
    return salt;
}

void add_message_to_ui(const string& from, const string& text, long long time) {
    time_t t = time / 1000;
    struct tm* tm_info = localtime(&t);
    char time_str[10];
    strftime(time_str, sizeof(time_str), "%H:%M", tm_info);
    
    string display = "[" + string(time_str) + "] " + from + ": " + text + "\r\n";
    
    SendMessageA(hListMessages, LB_ADDSTRING, 0, (LPARAM)display.c_str());
    SendMessageA(hListMessages, LB_SETTOPINDEX, SendMessageA(hListMessages, LB_GETCOUNT, 0, 0) - 1, 0);
}

void load_users() {
    web::http::client::http_client client(U("https://igneocxwtgnjuklerizs.supabase.co"));
    string url = "/rest/v1/users?select=id,username,online&neq=id." + current_user_id;
    
    web::http::http_request request(web::http::methods::GET);
    request.set_request_uri(web::http::uri::encode_uri(U(url)));
    request.headers().add(U("apikey"), U("sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    
    try {
        auto response = client.request(request).get();
        if (response.status_code() == 200) {
            auto json_response = response.extract_json().get();
            lock_guard<mutex> lock(users_mtx);
            users.clear();
            SendMessageA(hListUsers, LB_RESETCONTENT, 0, 0);
            
            for (auto& user : json_response.as_array()) {
                string id = user[U("id")].as_string();
                string name = user[U("username")].as_string();
                int online = user[U("online")].as_integer();
                string display = name + (online ? " ●" : " ○");
                users[id] = name;
                SendMessageA(hListUsers, LB_ADDSTRING, 0, (LPARAM)display.c_str());
                SendMessageA(hListUsers, LB_SETITEMDATA, SendMessageA(hListUsers, LB_GETCOUNT, 0, 0) - 1, (LPARAM)stoi(id.substr(0, 8), nullptr, 16));
            }
        }
    } catch (...) {}
}

void load_messages(const string& user_id) {
    web::http::client::http_client client(U("https://igneocxwtgnjuklerizs.supabase.co"));
    string url = "/rest/v1/messages?select=*&or=(from_id.eq." + current_user_id + ",to_id.eq." + current_user_id + ")&order=time.asc";
    
    web::http::http_request request(web::http::methods::GET);
    request.set_request_uri(web::http::uri::encode_uri(U(url)));
    request.headers().add(U("apikey"), U("sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    
    try {
        auto response = client.request(request).get();
        if (response.status_code() == 200) {
            auto json_response = response.extract_json().get();
            lock_guard<mutex> lock(messages_mtx);
            messages.clear();
            SendMessageA(hListMessages, LB_RESETCONTENT, 0, 0);
            
            for (auto& msg : json_response.as_array()) {
                string from_id = msg[U("from_id")].as_string();
                string to_id = msg[U("to_id")].as_string();
                if ((from_id == current_user_id && to_id == user_id) ||
                    (from_id == user_id && to_id == current_user_id)) {
                    string text = msg[U("text")].as_string();
                    long long time = msg[U("time")].as_integer();
                    string from_name = (from_id == current_user_id) ? current_username : users[from_id];
                    add_message_to_ui(from_name, text, time);
                }
            }
        }
    } catch (...) {}
}

void send_message(const string& text) {
    if (current_chat_id.empty() || text.empty()) return;
    
    web::http::client::http_client client(U("https://igneocxwtgnjuklerizs.supabase.co"));
    json body = {
        {"from_id", current_user_id},
        {"to_id", current_chat_id},
        {"text", text},
        {"time", chrono::duration_cast<chrono::milliseconds>(chrono::system_clock::now().time_since_epoch()).count()}
    };
    
    web::http::http_request request(web::http::methods::POST);
    request.set_request_uri(U("/rest/v1/messages"));
    request.set_body(body.dump());
    request.headers().add(U("apikey"), U("sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    request.headers().add(U("Authorization"), U("Bearer sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    
    try {
        client.request(request).get();
        add_message_to_ui(current_username, text, 
            chrono::duration_cast<chrono::milliseconds>(chrono::system_clock::now().time_since_epoch()).count());
    } catch (...) {}
}

void connect_websocket() {
    websocket = new ws_client();
    websocket->init_asio();
    websocket->set_access_channels(websocketpp::log::alevel::none);
    websocket->clear_access_channels(websocketpp::log::alevel::all);
    
    websocket->set_message_handler([](auto hdl, auto msg) {
        string payload = msg->get_payload();
        try {
            auto data = json::parse(payload);
            if (data.contains("type") && data["type"] == "INSERT") {
                auto record = data["payload"]["record"];
                if (record.contains("from_id")) {
                    string from_id = record["from_id"];
                    string to_id = record["to_id"];
                    string text = record["text"];
                    long long time = record["time"];
                    
                    if (from_id == current_user_id || to_id == current_user_id) {
                        string from_name = (from_id == current_user_id) ? current_username : users[from_id];
                        add_message_to_ui(from_name, text, time);
                        
                        if (current_chat_id.empty() || (from_id != current_chat_id && to_id != current_chat_id)) {
                            SetWindowTextA(hStaticStatus, ("New message from " + from_name).c_str());
                        }
                    }
                }
            }
        } catch (...) {}
    });
    
    websocket->set_open_handler([](auto hdl) {
        ws_hdl = hdl;
        json auth = {{"type", "access_token"}, {"payload", {{"access_token", session_token}}}};
        websocket->send(hdl, auth.dump(), websocketpp::frame::opcode::text);
        json sub = {{"type", "subscribe"}, {"topic", "realtime:public:messages"}};
        websocket->send(hdl, sub.dump(), websocketpp::frame::opcode::text);
        json sub_users = {{"type", "subscribe"}, {"topic", "realtime:public:users"}};
        websocket->send(hdl, sub_users.dump(), websocketpp::frame::opcode::text);
    });
    
    websocket->set_close_handler([](auto hdl) {
        SetWindowTextA(hStaticStatus, "Reconnecting...");
        Sleep(3000);
        connect_websocket();
    });
    
    websocketpp::lib::error_code ec;
    string ws_url = "wss://igneocxwtgnjuklerizs.supabase.co/realtime/v1/websocket?apikey=sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-";
    auto con = websocket->get_connection(ws_url, ec);
    if (!ec) websocket->connect(con);
    
    thread ws_thread([]() { websocket->run(); });
    ws_thread.detach();
}

void login_user(const string& username, const string& password) {
    web::http::client::http_client client(U("https://igneocxwtgnjuklerizs.supabase.co"));
    json body = {{"username", username}, {"password", password}};
    
    web::http::http_request request(web::http::methods::POST);
    request.set_request_uri(U("/rest/v1/rpc/login"));
    request.set_body(body.dump());
    request.headers().add(U("apikey"), U("sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    
    try {
        auto response = client.request(request).get();
        if (response.status_code() == 200) {
            auto json_response = response.extract_json().get();
            session_token = json_response[U("session")].as_string();
            current_user_id = json_response[U("id")].as_string();
            current_username = json_response[U("username")].as_string();
            
            SetWindowTextA(hStaticStatus, ("Online - " + current_username).c_str());
            ShowWindow(GetDlgItem(hMainWnd, ID_EDIT_USERNAME), SW_HIDE);
            ShowWindow(GetDlgItem(hMainWnd, ID_EDIT_PASSWORD), SW_HIDE);
            ShowWindow(GetDlgItem(hMainWnd, ID_BUTTON_LOGIN), SW_HIDE);
            ShowWindow(GetDlgItem(hMainWnd, ID_BUTTON_REGISTER), SW_HIDE);
            ShowWindow(hListUsers, SW_SHOW);
            ShowWindow(hListMessages, SW_SHOW);
            ShowWindow(hEditMessage, SW_SHOW);
            ShowWindow(hButtonSend, SW_SHOW);
            ShowWindow(hButtonCall, SW_SHOW);
            ShowWindow(hButtonScreen, SW_SHOW);
            
            connect_websocket();
            load_users();
        } else {
            MessageBoxA(hMainWnd, "Invalid username or password", "Login Failed", MB_ICONERROR);
        }
    } catch (...) {
        MessageBoxA(hMainWnd, "Connection error", "Error", MB_ICONERROR);
    }
}

void register_user(const string& username, const string& password) {
    web::http::client::http_client client(U("https://igneocxwtgnjuklerizs.supabase.co"));
    string salt = generate_salt();
    string hash = sha256(password + salt);
    
    json body = {{"username", username}, {"password", hash}, {"salt", salt}, {"online", 1}};
    
    web::http::http_request request(web::http::methods::POST);
    request.set_request_uri(U("/rest/v1/users"));
    request.set_body(body.dump());
    request.headers().add(U("apikey"), U("sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    request.headers().add(U("Authorization"), U("Bearer sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-"));
    request.headers().add(U("Prefer"), U("return=representation"));
    
    try {
        auto response = client.request(request).get();
        if (response.status_code() == 200 || response.status_code() == 201) {
            MessageBoxA(hMainWnd, "Registration successful! Please login.", "Success", MB_OK);
            login_user(username, password);
        } else {
            MessageBoxA(hMainWnd, "Username already taken", "Registration Failed", MB_ICONERROR);
        }
    } catch (...) {
        MessageBoxA(hMainWnd, "Connection error", "Error", MB_ICONERROR);
    }
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            hMainWnd = hWnd;
            
            HFONT hFont = CreateFont(16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH, L"Segoe UI");
            
            HWND hTitle = CreateWindowA("STATIC", "MESSENGER", WS_CHILD | WS_VISIBLE,
                20, 10, 400, 30, hWnd, NULL, hInst, NULL);
            SendMessage(hTitle, WM_SETFONT, (WPARAM)hFont, TRUE);
            
            CreateWindowA("STATIC", "Username:", WS_CHILD | WS_VISIBLE,
                20, 60, 80, 25, hWnd, NULL, hInst, NULL);
            CreateWindowA("EDIT", "", WS_CHILD | WS_VISIBLE | WS_BORDER,
                110, 58, 200, 28, hWnd, (HMENU)ID_EDIT_USERNAME, hInst, NULL);
            
            CreateWindowA("STATIC", "Password:", WS_CHILD | WS_VISIBLE,
                20, 100, 80, 25, hWnd, NULL, hInst, NULL);
            CreateWindowA("EDIT", "", WS_CHILD | WS_VISIBLE | WS_BORDER | ES_PASSWORD,
                110, 98, 200, 28, hWnd, (HMENU)ID_EDIT_PASSWORD, hInst, NULL);
            
            CreateWindowA("BUTTON", "Login", WS_CHILD | WS_VISIBLE,
                110, 140, 95, 35, hWnd, (HMENU)ID_BUTTON_LOGIN, hInst, NULL);
            CreateWindowA("BUTTON", "Register", WS_CHILD | WS_VISIBLE,
                215, 140, 95, 35, hWnd, (HMENU)ID_BUTTON_REGISTER, hInst, NULL);
            
            hStaticStatus = CreateWindowA("STATIC", "Not logged in", WS_CHILD | WS_VISIBLE,
                20, 190, 300, 25, hWnd, (HMENU)ID_STATIC_STATUS, hInst, NULL);
            SendMessage(hStaticStatus, WM_SETFONT, (WPARAM)hFont, TRUE);
            
            hListUsers = CreateWindowA("LISTBOX", "", WS_CHILD | WS_BORDER | WS_VSCROLL | LBS_NOTIFY,
                20, 230, 280, 400, hWnd, (HMENU)ID_LIST_USERS, hInst, NULL);
            SendMessage(hListUsers, WM_SETFONT, (WPARAM)hFont, TRUE);
            ShowWindow(hListUsers, SW_HIDE);
            
            hListMessages = CreateWindowA("LISTBOX", "", WS_CHILD | WS_BORDER | WS_VSCROLL | ES_MULTILINE,
                320, 60, 600, 500, hWnd, (HMENU)ID_LIST_MESSAGES, hInst, NULL);
            SendMessage(hListMessages, WM_SETFONT, (WPARAM)hFont, TRUE);
            ShowWindow(hListMessages, SW_HIDE);
            
            hEditMessage = CreateWindowA("EDIT", "", WS_CHILD | WS_BORDER | ES_MULTILINE | ES_AUTOVSCROLL,
                320, 570, 500, 70, hWnd, (HMENU)ID_EDIT_MESSAGE, hInst, NULL);
            SendMessage(hEditMessage, WM_SETFONT, (WPARAM)hFont, TRUE);
            ShowWindow(hEditMessage, SW_HIDE);
            
            hButtonSend = CreateWindowA("BUTTON", "Send", WS_CHILD,
                830, 585, 80, 50, hWnd, (HMENU)ID_BUTTON_SEND, hInst, NULL);
            ShowWindow(hButtonSend, SW_HIDE);
            
            hButtonCall = CreateWindowA("BUTTON", "📞 Call", WS_CHILD,
                430, 20, 80, 35, hWnd, (HMENU)ID_BUTTON_CALL, hInst, NULL);
            ShowWindow(hButtonCall, SW_HIDE);
            
            hButtonScreen = CreateWindowA("BUTTON", "📺 Screen", WS_CHILD,
                520, 20, 90, 35, hWnd, (HMENU)ID_BUTTON_SCREEN, hInst, NULL);
            ShowWindow(hButtonScreen, SW_HIDE);
            
            break;
        }
        case WM_COMMAND: {
            if (LOWORD(wParam) == ID_BUTTON_LOGIN) {
                char username[256], password[256];
                GetDlgItemTextA(hWnd, ID_EDIT_USERNAME, username, 256);
                GetDlgItemTextA(hWnd, ID_EDIT_PASSWORD, password, 256);
                if (strlen(username) > 0 && strlen(password) > 0) {
                    login_user(username, password);
                }
            }
            else if (LOWORD(wParam) == ID_BUTTON_REGISTER) {
                char username[256], password[256];
                GetDlgItemTextA(hWnd, ID_EDIT_USERNAME, username, 256);
                GetDlgItemTextA(hWnd, ID_EDIT_PASSWORD, password, 256);
                if (strlen(username) > 0 && strlen(password) > 0) {
                    register_user(username, password);
                }
            }
            else if (LOWORD(wParam) == ID_BUTTON_SEND) {
                char msg[4096];
                GetDlgItemTextA(hWnd, ID_EDIT_MESSAGE, msg, 4096);
                if (strlen(msg) > 0) {
                    send_message(msg);
                    SetDlgItemTextA(hWnd, ID_EDIT_MESSAGE, "");
                }
            }
            else if (LOWORD(wParam) == ID_LIST_USERS && HIWORD(wParam) == LBN_SELCHANGE) {
                int idx = SendMessageA(hListUsers, LB_GETCURSEL, 0, 0);
                if (idx != LB_ERR) {
                    char name[256];
                    SendMessageA(hListUsers, LB_GETTEXT, idx, (LPARAM)name);
                    string name_str(name);
                    size_t space = name_str.find(" ");
                    if (space != string::npos) name_str = name_str.substr(0, space);
                    
                    for (auto& [id, uname] : users) {
                        if (uname == name_str) {
                            current_chat_id = id;
                            current_chat_name = uname;
                            SetWindowTextA(hStaticStatus, ("Chat with " + current_chat_name).c_str());
                            load_messages(id);
                            EnableWindow(hButtonCall, TRUE);
                            EnableWindow(hButtonScreen, TRUE);
                            break;
                        }
                    }
                }
            }
            else if (LOWORD(wParam) == ID_BUTTON_CALL) {
                if (is_in_call) {
                    is_in_call = false;
                    SetWindowTextA(hButtonCall, "📞 Call");
                    MessageBoxA(hWnd, "Call ended", "Call", MB_OK);
                } else if (!current_chat_id.empty()) {
                    is_in_call = true;
                    SetWindowTextA(hButtonCall, "🔴 End Call");
                    MessageBoxA(hWnd, ("Calling " + current_chat_name + "...").c_str(), "Call", MB_OK);
                }
            }
            else if (LOWORD(wParam) == ID_BUTTON_SCREEN) {
                MessageBoxA(hWnd, "Screen share feature\nShare your screen with other users", "Screen Share", MB_OK);
            }
            break;
        }
        case WM_SIZE: {
            RECT rc;
            GetClientRect(hWnd, &rc);
            int width = rc.right;
            int height = rc.bottom;
            
            MoveWindow(hListUsers, 20, 230, 280, height - 260, TRUE);
            MoveWindow(hListMessages, 320, 60, width - 340, height - 140, TRUE);
            MoveWindow(hEditMessage, 320, height - 80, width - 420, 60, TRUE);
            MoveWindow(hButtonSend, width - 90, height - 75, 80, 50, TRUE);
            MoveWindow(hButtonCall, width - 240, 20, 80, 35, TRUE);
            MoveWindow(hButtonScreen, width - 150, 20, 90, 35, TRUE);
            break;
        }
        case WM_DESTROY: {
            PostQuitMessage(0);
            break;
        }
        default:
            return DefWindowProc(hWnd, msg, wParam, lParam);
    }
    return 0;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    hInst = hInstance;
    
    WNDCLASSA wc = {};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hbrBackground = CreateSolidBrush(RGB(26, 26, 26));
    wc.lpszClassName = "MessengerClass";
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    
    RegisterClassA(&wc);
    
    hMainWnd = CreateWindowA("MessengerClass", "Messenger - Beautiful GUI", 
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT, CW_USEDEFAULT, 950, 700,
        NULL, NULL, hInstance, NULL);
    
    ShowWindow(hMainWnd, nCmdShow);
    UpdateWindow(hMainWnd);
    
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    
    return 0;
}