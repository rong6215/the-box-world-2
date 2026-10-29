# THE BOX WORLD 2 - Android Project Guide (คู่มือสำหรับ Android)

โปรเจกต์นี้มีระบบรองรับการเล่นบนอุปกรณ์ **Android** ได้อย่างสมบูรณ์แบบ 2 ช่องทาง:

---

## 🌟 ช่องทางที่ 1: เล่นผ่าน Android Browser & ติดตั้งเป็น Web App (PWA) — สะดวกสุด ไม่ต้องติดตั้งโปรแกรมเพิ่ม

1. เปิดเครื่องคอมพิวเตอร์และรันเซิร์ฟเวอร์:
   ```bash
   npm start
   ```
2. บนมือถือ Android ให้เปิดเบราว์เซอร์ **Google Chrome**:
   * หากอยู่ในวง Wi-Fi เดียวกัน: เข้า `http://<IP_คอมพิวเตอร์ของคุณ>:3000`
   * หรือหากใช้ Cloudflare Tunnel / ngrok: เข้าผ่านลิงก์ `https://...`
3. กดปุ่มเมนู 3 จุดบน Chrome (ขวาบน) แล้วเลือก **"ติดตั้งแอปลงบนอุปกรณ์" (Install App)** หรือ **"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)**
4. ระบบจะสร้างไอคอนเกมลงบนหน้าจอมือถือของคุณทันที และเปิดเล่นแบบ **เต็มจอ 100% (Full Screen)** ไม่มีแถบ URL เหมือนแอปเกมทั่วไป!

---

## 📦 ช่องทางที่ 2: Build เป็นไฟล์ APK ติดตั้งลงเครื่อง (Android Studio Project)

โฟลเดอร์ `android/` นี้เป็นโปรเจกต์ Android Studio แท้ที่พร้อมเปิดและ Build ได้ทันที:

### ขั้นตอนการ Build APK:
1. ดาวน์โหลดและเปิดโปรแกรม **[Android Studio](https://developer.android.com/studio)**
2. เลือกเมนู **Open** แล้วเลือกโฟลเดอร์ `ro-survivors/android`
3. รอ Android Studio ทำการ Sync Gradle จนเสร็จสมบูรณ์
4. ปรับเปลี่ยน URL เซิร์ฟเวอร์ในไฟล์ `MainActivity.kt`:
   * สำหรับ Android Emulator: ใช้ `http://10.0.2.2:3000` (ค่าเริ่มต้น)
   * สำหรับเครื่องจริงใน Wi-Fi: เปลี่ยนเป็น IP เครื่องคอม เช่น `http://192.168.1.50:3000`
   * สำหรับออนไลน์ทั่วโลก: ใส่ลิงก์ Cloudflare Tunnel เช่น `https://xxxx.trycloudflare.com`
5. ไปที่เมนู **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**
6. นำไฟล์ `.apk` ที่ได้ไปติดตั้งลงบนมือถือ Android เล่นได้ทันที!
