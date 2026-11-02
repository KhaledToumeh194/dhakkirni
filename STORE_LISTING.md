# Chrome Web Store listing

## Single purpose

Reminds the user, through silent notifications, to make dhikr during the day and to pray at each prayer time.

## Name

- English: Dhakkirni – Dhikr & Prayer Reminder
- Arabic: ذكّرني – أذكار ومواقيت الصلاة

## Short description (132 characters max)

- English: Silent reminders for istighfar, dhikr and salawat while you work, and a notification at each prayer time.
- Arabic: تذكير صامت بالاستغفار والذكر والصلاة على النبي ﷺ أثناء العمل، وتنبيه عند دخول وقت كل صلاة.

## Description

### English

Dhakkirni sends a quiet reminder every 30 minutes, or at an interval you pick, to say istighfar, a dhikr, or salawat on the Prophet ﷺ. Each reminder shows a short authentic wording in Arabic and English, with its source from the Quran or the hadith collections.

It also shows a notification when each prayer time begins, and an optional one a few minutes before.

Prayer times are calculated on your computer for any place in the world. You can choose from the common methods (Muslim World League, Umm al-Qura, Egyptian, Karachi, ISNA, Moonsighting Committee, Dubai, Qatar, Kuwait, Singapore, Diyanet, Tehran) or enter your own angles. Asr can follow the standard or the Hanafi rule. High-latitude rules cover places where twilight lasts all night in summer. To match your mosque's timetable, move each prayer a few minutes earlier or later in its Adjust field.

All notifications are silent. Quiet hours pause dhikr reminders but never prayer notifications. The extension works in Arabic, in English, or in both at once.

Everything works offline. Your location stays on your computer, and the extension makes no network requests. There are no accounts, no ads and no tracking.

### Arabic

يرسل «ذكّرني» تذكيرًا هادئًا كل ثلاثين دقيقة، أو كل مدة تختارها، بالاستغفار أو بذكر من الأذكار أو بالصلاة على النبي ﷺ. يعرض كل تذكير صيغة قصيرة ثابتة بالعربية والإنجليزية، مع مصدرها من القرآن أو كتب الحديث.

ويعرض أيضًا تنبيهًا عند دخول وقت كل صلاة، وتنبيهًا اختياريًا قبلها ببضع دقائق.

تُحسب المواقيت على جهازك لأي مكان في العالم. يمكنك اختيار إحدى الطرق المعروفة (رابطة العالم الإسلامي، أم القرى، الهيئة المصرية، كراتشي، أمريكا الشمالية، لجنة رؤية الهلال، دبي، قطر، الكويت، سنغافورة، الشؤون الدينية التركية، طهران)، أو إدخال زوايا خاصة. ويمكن حساب العصر على قول الجمهور أو على المذهب الحنفي. وفي خطوط العرض العليا، حيث قد يستمر الشفق طوال ليل الصيف، توجد قواعد خاصة لذلك. ولتطابق المواقيت جدول مسجدك، قدّم كل صلاة أو أخّرها بضع دقائق في خانة التعديل الخاصة بها.

كل التنبيهات صامتة. ساعات الهدوء توقف تذكير الذكر ولا توقف تنبيهات الصلاة. وتعمل الإضافة بالعربية أو بالإنجليزية أو بهما معًا.

كل شيء يعمل دون اتصال. موقعك يبقى على جهازك، ولا ترسل الإضافة أي طلب عبر الشبكة. لا حسابات ولا إعلانات ولا تتبّع.

## Category and language

- Category: Productivity (or Lifestyle)
- Languages: English, Arabic

## Permission justifications

- **alarms**: Schedules each prayer notification, the reminder before it, the repeating dhikr reminder, and a daily recalculation just after midnight. Chrome alarms are the only way an MV3 extension can wake up at a set time.
- **notifications**: Shows the reminders. They are silent system notifications. One fixed ID per kind means a new one replaces the old one instead of piling up.
- **storage**: Saves the user's settings, and keeps their location in local storage on the device.

There are no host permissions and no content scripts. The extension does not read or change any web page and makes no network requests.

## Privacy practices tab

- **Single purpose:** as above.
- **Remote code:** No. All JavaScript, fonts and data ship in the package, and nothing is downloaded.
- **Data usage:** Tick **Location**. The extension handles GPS coordinates that the user enters or allows. They are stored on the device and used only to calculate prayer times. They are never sent anywhere. No other category applies. There is no personally identifiable information, health, financial, authentication, communications, web history or user activity data, and no website content.
- **Certifications:** Tick all three. Data is not sold or transferred to third parties. It is not used for purposes unrelated to the single purpose. It is not used to determine creditworthiness or for lending.
- **Privacy policy URL:** a public link to `PRIVACY.md`, for example the file on GitHub or a GitHub Pages copy.

Check the current wording of the dashboard questions when you submit. Google changes them from time to time.

## Notes for the reviewer

No account is needed. After installing, the settings page opens. Click "Use my location", or type 21.42 and 39.83, then Save. Today's times appear at the top. Click "Send test notification" to see a reminder. The extension works fully offline.

## Assets

Already made:

- Icons: `extension/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`. The source is `store/logo.svg` and a large preview is `store/logo-512.png`. The 128 px icon has 96 px of artwork with 16 px of transparent padding, as the store asks.
- Screenshots at 1280x800: `store/options-en-1280.png` and `store/options-ar-1280.png`.

Still to produce:

- Up to three more 1280x800 screenshots, ideally a real prayer notification and a dhikr notification as they look on your system (Windows or macOS). Notifications can't be captured in a headless browser.
- A small promo tile, 440x280 PNG or JPEG. It is required for the listing.
- Optional: a marquee promo tile, 1400x560.
- A support email or URL, and the privacy policy URL.
