# مدیریت فعالیت‌ها — نسخه‌ی React

همان پروژه‌ی HTML/CSS/jQuery، بازنویسی‌شده با React (Vite) بدون تغییر در ظاهر.

## اجرا

```bash
npm install
npm run dev      # http://localhost:5501
npm run build    # خروجی در پوشه‌ی dist
```

## ساختار

```
src/
  style.css            ← همان style.css اصلی، بدون هیچ تغییری
  fonts/               ← فونت Vazirmatn
  initialData.js       ← متن‌ها و کارت‌های اولیه
  App.jsx              ← تب‌ها، state کارت‌ها، لاگ‌ها، پیوست‌ها
  components/
    icons.jsx          ← SVGهای اصلی (تبدیل‌شده به JSX)
    FeedbackPanel.jsx  ← نوار ابزار، فرم بازخورد جدید، ضبط ویس، اکسل/چاپ
    FeedbackCard.jsx / TextCard.jsx / VoiceCard.jsx
    AudioPlayer.jsx    ← پخش‌کننده و موج صوتی
    CardParts.jsx      ← ویرایش درجا، پاسخ‌ها
    TabPanel.jsx, Toast.jsx
  hooks/
    useCard.js         ← حذف / ویرایش / پاسخ / وضعیت
    useVoiceRecorder.js← ضبط ویس با MediaRecorder
  animate.js           ← جایگزین slideDown/slideUp/fadeIn جی‌کوئری
public/img/            ← تصاویر
```

## نکته‌ها

- کلاس‌ها و ساختار DOM همان نسخه‌ی اصلی است؛ بنابراین CSS بدون تغییر کار می‌کند.
- پیام‌های toast در نسخه‌ی jQuery به‌خاطر `[hidden]{display:none!important}` هرگز دیده نمی‌شدند؛ در این نسخه درست نمایش داده می‌شوند.
- ضبط ویس فقط روی `localhost` یا HTTPS کار می‌کند (محدودیت مرورگر).
