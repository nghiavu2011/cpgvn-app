# CPG VN AI Architect

Ứng dụng hỗ trợ thiết kế kiến trúc bằng công nghệ AI của Google Gemini.

## 🚀 Hướng dẫn cài đặt & Tham gia sử dụng

### 1. Lấy Gemini API Key
Để ứng dụng có thể hoạt động, bạn cần một API Key miễn phí từ Google:
1.  Truy cập vào [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Đăng nhập bằng tài khoản Google của bạn.
3.  Nhấn nút **Create API key**.
4.  Sao chép đoạn mã API Key vừa tạo.

### 2. Cấu hình ứng dụng
Khi bạn mở ứng dụng lần đầu tiên (hoặc nhấn vào biểu tượng **Chìa khóa** ở góc trên bên phải):
*   Dán API Key đã sao chép ở bước trên vào ô nhập liệu.
*   Nhấn **Lưu Cấu Hình**.
*   **Lưu ý:** API Key của bạn được lưu trực tiếp và an toàn trong trình duyệt (localStorage) của bạn. Chúng tôi KHÔNG lưu trữ API Key này trên bất kỳ máy chủ nào.

## 🛠 Triển khai lên GitHub & Vercel

### 1. Đưa lên GitHub
1.  Tạo một repository mới trên [GitHub](https://github.com/new).
2.  Tại thư mục code này, chạy các lệnh sau (nếu bạn dùng Git CLI):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/USERNAME/REPO_NAME.git
    git push -u origin main
    ```

### 2. Deploy lên Vercel
1.  Truy cập [Vercel](https://vercel.com/new).
2.  Kết nối tài khoản GitHub và Import repository bạn vừa tạo.
3.  Vercel sẽ tự động nhận diện Project Vite và triển khai chỉ trong vài giây.
4.  Sau khi xong, bạn sẽ nhận được một địa chỉ URL (ví dụ: `your-app.vercel.app`) để truy cập từ bất cứ đâu.

## ✨ Các tính năng chính
*   **Render Ngoại Thất/Nội Thất:** Biến ảnh chụp hiện trạng hoặc phác thảo thành phối cảnh thực tế.
*   **Layout 2D to 3D:** Tự động dựng phối cảnh từ mặt bằng 2D.
*   **Virtual Tour:** Tạo trải nghiệm di chuyển camera từ ảnh tĩnh.
*   **Inpainting:** Chỉnh sửa, thêm/xóa vật thể bằng tô vẽ trên ảnh.
*   **Diagram & Presentation:** Tự động tạo sơ đồ phân tích và bảng trình bày concept.

---
© 2024 CPG Vietnam.
