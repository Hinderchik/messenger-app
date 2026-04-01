#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <string>
#include <vector>
#include <map>
#include <thread>
#include <mutex>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <algorithm>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "comctl32.lib")

using namespace std;

// Простые структуры вместо JSON
struct User {
    string id;
    string username;
    bool online;
};

struct Message {
    string id;
    string from_id;
    string to_id;
    string text;
    long long time;
};

// Глобальные переменные
string current_user_id;
string current_username;
string current_chat_id;
string session_token;
map<string, string> users;
vector<Message> messages;
mutex messages_mtx;
mutex users_mtx;

// ID элементов GUI
#define ID_EDIT_MESSAGE 1001
#define ID_BUTTON_SEND 1002
#define ID_LIST_USERS 1003
#define ID_LIST_MESSAGES 1004
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
HWND hStaticStatus;

// Функции
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
    
    string display = "[" + string(time_str) + "] " + from + ": " + text;
    SendMessageA(hListMessages, LB_ADDSTRING, 0, (LPARAM)display.c_str());
    SendMessageA(hListMessages, LB_SETTOPINDEX, SendMessageA(hListMessages, LB_GETCOUNT, 0, 0) - 1, 0);
}

void login_user(const string& username, const string& password) {
    // Временная заглушка для теста
    current_username = username;
    current_user_id = "test_user_1";
    
    SetWindowTextA(hStaticStatus, ("Online - " + current_username).c_str());
    ShowWindow(GetDlgItem(hMainWnd, ID_EDIT_USERNAME), SW_HIDE);
    ShowWindow(GetDlgItem(hMainWnd, ID_EDIT_PASSWORD), SW_HIDE);
    ShowWindow(GetDlgItem(hMainWnd, ID_BUTTON_LOGIN), SW_HIDE);
    ShowWindow(GetDlgItem(hMainWnd, ID_BUTTON_REGISTER), SW_HIDE);
    ShowWindow(hListUsers, SW_SHOW);
    ShowWindow(hListMessages, SW_SHOW);
    ShowWindow(hEditMessage, SW_SHOW);
    ShowWindow(hButtonSend, SW_SHOW);
    
    // Добавляем тестовых пользователей
    SendMessageA(hListUsers, LB_ADDSTRING, 0, (LPARAM)"Test User ●");
    SendMessageA(hListUsers, LB_ADDSTRING, 0, (LPARAM)"Friend ●");
}

void send_message(const string& text) {
    if (current_chat_id.empty() || text.empty()) return;
    
    // Добавляем сообщение в UI
    add_message_to_ui(current_username, text, 
        chrono::duration_cast<chrono::milliseconds>(chrono::system_clock::now().time_since_epoch()).count());
    
    SetDlgItemTextA(hMainWnd, ID_EDIT_MESSAGE, "");
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            hMainWnd = hWnd;
            
            HFONT hFont = CreateFont(16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH, L"Segoe UI");
            
            CreateWindowA("STATIC", "MESSENGER", WS_CHILD | WS_VISIBLE, 20, 10, 400, 30, hWnd, NULL, hInst, NULL);
            
            CreateWindowA("STATIC", "Username:", WS_CHILD | WS_VISIBLE, 20, 60, 80, 25, hWnd, NULL, hInst, NULL);
            CreateWindowA("EDIT", "", WS_CHILD | WS_VISIBLE | WS_BORDER, 110, 58, 200, 28, hWnd, (HMENU)ID_EDIT_USERNAME, hInst, NULL);
            
            CreateWindowA("STATIC", "Password:", WS_CHILD | WS_VISIBLE, 20, 100, 80, 25, hWnd, NULL, hInst, NULL);
            CreateWindowA("EDIT", "", WS_CHILD | WS_VISIBLE | WS_BORDER | ES_PASSWORD, 110, 98, 200, 28, hWnd, (HMENU)ID_EDIT_PASSWORD, hInst, NULL);
            
            CreateWindowA("BUTTON", "Login", WS_CHILD | WS_VISIBLE, 110, 140, 95, 35, hWnd, (HMENU)ID_BUTTON_LOGIN, hInst, NULL);
            CreateWindowA("BUTTON", "Register", WS_CHILD | WS_VISIBLE, 215, 140, 95, 35, hWnd, (HMENU)ID_BUTTON_REGISTER, hInst, NULL);
            
            hStaticStatus = CreateWindowA("STATIC", "Not logged in", WS_CHILD | WS_VISIBLE, 20, 190, 300, 25, hWnd, (HMENU)ID_STATIC_STATUS, hInst, NULL);
            SendMessage(hStaticStatus, WM_SETFONT, (WPARAM)hFont, TRUE);
            
            hListUsers = CreateWindowA("LISTBOX", "", WS_CHILD | WS_BORDER | WS_VSCROLL | LBS_NOTIFY, 20, 230, 280, 400, hWnd, (HMENU)ID_LIST_USERS, hInst, NULL);
            SendMessage(hListUsers, WM_SETFONT, (WPARAM)hFont, TRUE);
            ShowWindow(hListUsers, SW_HIDE);
            
            hListMessages = CreateWindowA("LISTBOX", "", WS_CHILD | WS_BORDER | WS_VSCROLL, 320, 60, 600, 500, hWnd, (HMENU)ID_LIST_MESSAGES, hInst, NULL);
            SendMessage(hListMessages, WM_SETFONT, (WPARAM)hFont, TRUE);
            ShowWindow(hListMessages, SW_HIDE);
            
            hEditMessage = CreateWindowA("EDIT", "", WS_CHILD | WS_BORDER | ES_MULTILINE | ES_AUTOVSCROLL, 320, 570, 500, 70, hWnd, (HMENU)ID_EDIT_MESSAGE, hInst, NULL);
            SendMessage(hEditMessage, WM_SETFONT, (WPARAM)hFont, TRUE);
            ShowWindow(hEditMessage, SW_HIDE);
            
            hButtonSend = CreateWindowA("BUTTON", "Send", WS_CHILD, 830, 585, 80, 50, hWnd, (HMENU)ID_BUTTON_SEND, hInst, NULL);
            ShowWindow(hButtonSend, SW_HIDE);
            
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
                    MessageBoxA(hWnd, "Registration successful!", "Success", MB_OK);
                    login_user(username, password);
                }
            }
            else if (LOWORD(wParam) == ID_BUTTON_SEND) {
                char msg[4096];
                GetDlgItemTextA(hWnd, ID_EDIT_MESSAGE, msg, 4096);
                if (strlen(msg) > 0) {
                    send_message(msg);
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
                    current_chat_id = "test_chat_" + to_string(idx);
                    SetWindowTextA(hStaticStatus, ("Chat with " + name_str).c_str());
                }
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
    
    hMainWnd = CreateWindowA("MessengerClass", "Messenger", 
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