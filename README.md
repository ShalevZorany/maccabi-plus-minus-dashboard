# maccabicheck

דאשבורד למדד פלוס/מינוס של שחקני מכבי תל אביב בליגת העל בעונת `2025/2026`.

במקומי אפשר לייבא ולרענן נתונים. בפריסה ל-Vercel האתר עובד כסנאפשוט קריא של `data/matches.json`, כי מערכת הקבצים של Vercel Functions אינה אחסון קבוע לכתיבה.

## הרצה

```bash
cd "/Users/shalevzorany/Desktop/פיתוח/projects-hub/maccabicheck"
npm install
npm run import
npm start
```

ואז לפתוח:

```text
http://localhost:3005
```

אין לפרויקט תלויות npm כרגע, כך ש-`npm install` לא אמור להוריד חבילות. אם רוצים לראות את הדאשבורד לפני ייבוא, אפשר להריץ רק `npm start`; הוא יציג מצב ריק.

## מקור הנתונים

הייבוא האוטומטי משתמש באתר הרשמי של מכבי תל אביב:

```text
https://www.maccabi-tlv.co.il/en/result-fixtures/first-team/results/
https://www.maccabi-tlv.co.il/en/result-fixtures/first-team/fixtures/
```

לכל משחק נשמרים `source.url`, `source.detailsUrl`, ו-`source.lineupsUrl`. דפי ההתאחדות לכדורגל יכולים להישמר ב-`source.ifaUrl` כאימות ידני, אבל אינם מקור הייבוא האוטומטי כי בקשות `curl`/Node מקומיות נחסמות כרגע ב-Cloudflare.

## מגבלות שחשוב להכיר

- אתר מכבי מציג בחלק מהמקרים דקות תוספת זמן כדקת בסיס, למשל `45` במקום `45+2`; לכן משחקים מיובאים מסומנים `minutePrecision: "base-minute"`.
- משחקים עתידיים/לא משוחקים נשמרים אבל אינם נכנסים לחישוב.
- משחק שהסתיים אבל חסר בו הרכב, שערים או חילופי מכבי מלאים יסומן כלא כשיר ולא ייכנס למדד.
- אין השלמת נתונים ידנית שקטה. אם אין מקור ברור, הנתון נשאר חסר ומוצג בדאשבורד.
- ב-Vercel רענון/ייבוא דרך UI מוחזר כ-read-only. עדכון נתונים לפרודקשן נעשה מקומית ואז ב-commit של `data/matches.json`.

## ייבוא ידני

אפשר לייבא דרך הדאשבורד קובץ JSON או CSV. דוגמאות נמצאות ב:

```text
data/manual-import.example.json
data/manual-import.example.csv
```

CSV משתמש בשדות `goals` בפורמט:

```text
minute|team|scorer;minute|team|scorer
```

ובשדות `substitutions` בפורמט:

```text
minute|playerIn|playerOut;minute|playerIn|playerOut
```

## בדיקות

```bash
npm test
```

אם `npm` לא זמין בסביבה הנוכחית, אפשר להריץ את בדיקות הלוגיקה שאינן דורשות Express:

```bash
node --test tests/plusMinus.test.mjs tests/importer.test.mjs
```

## מבנה

```text
src/calculate.mjs             חישוב מדד פלוס/מינוס
src/validation.mjs            בדיקות שלמות ואיכות נתונים
src/importers/maccabi-importer.mjs
src/importers/manual-importer.mjs
src/server.mjs                Local Node API + static frontend
api/                          Vercel read-only API handlers
public/                       Vanilla dashboard
data/matches.json             אחסון מקומי
```
