# Hướng Dẫn Triển Khai (Deployment Guide)

Ứng dụng CPGVN App đã được chuẩn bị sẵn sàng để đưa lên GitHub và Vercel.

## 1. Đưa lên GitHub
Vì bạn đã có source code tại máy, bạn cần tạo một kho chứa (repository) mới trên GitHub.

1.  Truy cập [GitHub New Repository](https://github.com/new).
2.  Đặt tên cho repository (ví dụ: `cpgvn-app`).
3.  Để chế độ **Public** hoặc **Private** tùy ý.
4.  Không tick vào "Initialize this repository with a README".
5.  Nhấn **Create repository**.

Sau khi tạo xong, chạy các lệnh sau trong terminal của thư mục dự án này:

```bash
# Thay thế URL bên dưới bằng URL repository của bạn
git remote add origin https://github.com/USERNAME/cpgvn-app.git
git branch -M main
git push -u origin main
```

## 2. Triển khai lên Vercel
1.  Truy cập [Vercel Dashboard](https://vercel.com/dashboard).
2.  Nhấn **Add New...** -> **Project**.
3.  Chọn repository `cpgvn-app` bạn vừa đẩy lên GitHub.
4.  Vercel sẽ tự động phát hiện đây là dự án Vite. Các cài đặt mặc định (Build command: `vite build`, Output directory: `dist`) thường là chính xác.
5.  Nhấn **Deploy**.

## 3. Cấu hình API Key
Hiện tại, ứng dụng đã được tích hợp tính năng **"User API Key"**.
- Người dùng khi vào app sẽ thấy một biểu tượng chìa khóa hoặc được yêu cầu nhập API Key.
- Hướng dẫn lấy key từ Google AI Studio đã được tích hợp ngay trong hộp thoại nhập key.
- Key sẽ được lưu vào trình duyệt của người dùng (Local Storage), không cần cấu hình Environment Variable trên Vercel (trừ khi bạn muốn set key mặc định cho hệ thống, nhưng điều này không khuyến khích nếu công khai app).

## 4. Kiểm tra
Sau khi deploy xong, truy cập đường link Vercel cung cấp (ví dụ: `https://cpgvn-app.vercel.app`) và thử nghiệm tính năng nhập API Key.
