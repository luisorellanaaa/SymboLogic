import webview
import sys
import os
import json
import ctypes

def get_base_path():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

def get_data_file():
    if hasattr(sys, 'frozen'):
        return os.path.join(os.path.dirname(sys.executable), 'game_data.json')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game_data.json')

class Api:
    def get_data(self):
        try:
            with open(get_data_file(), 'r') as f:
                return json.load(f)
        except Exception:
            return {"users": {"admin": {"password": "admin123", "role": "admin"}}, "scores": []}

    def save_data(self, data):
        try:
            with open(get_data_file(), 'w') as f:
                json.dump(data, f)
            return True
        except Exception as e:
            print("Error saving:", e)
            return False

    def change_titlebar_theme(self, is_dark):
        if os.name == 'nt':
            try:
                hwnd = ctypes.windll.user32.FindWindowW(None, "SymboLogic")
                if hwnd:
                    # 0 = Light, 1 = Dark
                    value = ctypes.c_int(1 if is_dark else 0)
                    ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(value), ctypes.sizeof(value))
                    ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 19, ctypes.byref(value), ctypes.sizeof(value))
            except Exception as e:
                print("DWM Error:", e)

frontend_dir = os.path.join(get_base_path(), 'frontend')
index_html = os.path.join(frontend_dir, 'index.html')

if __name__ == '__main__':
    api = Api()
    
    icon_path = os.path.join(get_base_path(), 'icon.ico')
    
    webview.create_window(
        title="SymboLogic",
        url=index_html,
        js_api=api,
        width=1200,
        height=800,
        min_size=(800, 600),
        background_color='#ffffff', # Light mode base color
        maximized=True
    )
    
    # We will trigger the titlebar update via JS once loaded.
    webview.start(private_mode=False)
