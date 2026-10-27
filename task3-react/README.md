# بایوآرک — نسخه‌ی React

همان پروژه‌ی `task3-js` (HTML + CSS + jQuery) که با React بازنویسی شده است؛ ظاهر و استایل بدون تغییر.

## اجرا

```bash
npm install
npm run dev      # حالت توسعه
npm run build    # خروجی نهایی در پوشه‌ی dist
```

## ساختار

```
src/
├── main.jsx             نقطه‌ی ورود
├── App.jsx              کل صفحه + منطق (جایگزین script.js)
├── style.css            همان style.css اصلی، بدون هیچ تغییری
├── animations.css       معادل انیمیشن‌های jQuery (fadeIn / fadeOut / slideToggle)
├── components/
│   ├── icons.jsx        SVGهای اصلی index.html (فقط به JSX تبدیل شده‌اند)
│   ├── Popover.jsx      پاپ‌آور + فرم‌های داخل آن (پیوند، تراز، منشن، QR، تأیید بستن)
│   ├── Toast.jsx
│   └── History.jsx      بازخوردهای ثبت‌شده
├── lib/
│   ├── db.js            localStorage / IndexedDB
│   └── utils.js         کاربران نمونه، sanitize، formatSize و ...
├── fonts/               Vazirmatn
└── img/avatar.png
```

## نکات

- jQuery حذف شده و همه‌ی رفتارها با React پیاده شده‌اند: ادیتور و نوار ابزار، منشن، آپلود (انتخاب/کشیدن/دوربین)، ضبط صدا، ثبت، بستن/نمایش دوباره‌ی فرم، و ماندگاری بعد از رفرش.
- برای اتصال به سرور، رویداد `feedback:submit` روی `document` ارسال می‌شود (`event.detail` همان payload است)، دقیقاً مثل نسخه‌ی قبل.
