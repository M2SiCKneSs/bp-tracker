/** Every user-visible string in the app. Single language, so no i18n library. */
export const t = {
  appName: 'מעקב לחץ דם',

  tabs: { entry: 'הזנה', graph: 'גרף', settings: 'הגדרות' },

  login: {
    title: 'כניסה',
    subtitle: 'האפליקציה מיועדת למשתמש יחיד',
    email: 'אימייל',
    password: 'סיסמה',
    submit: 'כניסה',
    working: 'מתחבר…',
    failed: 'הכניסה נכשלה. בדוק את האימייל והסיסמה.',
  },

  entry: {
    title: 'מדידה חדשה',
    editTitle: 'עריכת מדידה',
    date: 'תאריך',
    systolic: 'לחץ עליון (סיסטולי)',
    diastolic: 'לחץ תחתון (דיאסטולי)',
    pulse: 'דופק',
    pulseOptional: 'דופק (לא חובה)',
    timeOfDay: 'זמן המדידה',
    note: 'הערה (לא חובה)',
    notePlaceholder: 'למשל: אחרי קפה, הרגשתי סחרחורת',
    save: 'שמירה',
    saveEdit: 'עדכון',
    cancelEdit: 'ביטול עריכה',
    saving: 'שומר…',
    saved: 'המדידה נשמרה',
    unit: 'מ"מ כספית',
    bpm: 'פעימות לדקה',
  },

  timeOfDay: { morning: 'בוקר', evening: 'ערב', other: 'אחר' } as const,

  validation: {
    systolicRange: 'הלחץ העליון חייב להיות בין 50 ל-300.',
    diastolicRange: 'הלחץ התחתון חייב להיות בין 30 ל-200.',
    pulseRange: 'הדופק חייב להיות בין 20 ל-250.',
    order: 'הלחץ העליון חייב להיות גבוה מהלחץ התחתון.',
    dateRequired: 'יש לבחור תאריך.',
    dateFuture: 'לא ניתן להזין מדידה בתאריך עתידי.',
  },

  category: {
    normal: 'תקין',
    elevated: 'גבולי',
    stage1: 'לחץ דם גבוה — שלב 1',
    stage2: 'לחץ דם גבוה — שלב 2',
    crisis: 'ערכים גבוהים מאוד — מומלץ לפנות לרופא',
  },

  history: {
    title: 'מדידות אחרונות',
    empty: 'עדיין אין מדידות. הוסף את הראשונה למעלה.',
    edit: 'עריכה',
    delete: 'מחיקה',
    confirmDelete: 'למחוק את המדידה הזאת?',
  },

  graph: {
    title: 'מגמה לאורך זמן',
    empty: 'אין מדידות בטווח הזה.',
    ranges: { d30: '30 יום', d90: '90 יום', y1: 'שנה', all: 'הכל' },
    filterLabel: 'סינון',
    filters: { all: 'הכל', morning: 'בוקר', evening: 'ערב' },
    showPulse: 'הצג דופק',
    series: { systolic: 'עליון', diastolic: 'תחתון', pulse: 'דופק' },
    avgSystolic: 'ממוצע עליון',
    avgDiastolic: 'ממוצע תחתון',
    count: 'מדידות',
    showTable: 'הצג כטבלה',
    hideTable: 'הסתר טבלה',
    refNormal: 'תקין',
    refHigh: 'סף גבוה',
  },

  settings: {
    title: 'הגדרות',
    notifications: 'התראות',
    enable: 'הפעל התראות בטלפון',
    unsupported: 'הדפדפן הזה לא תומך בהתראות דחיפה.',
    denied: 'ההתראות חסומות בהגדרות הדפדפן. יש לאפשר אותן ידנית ולנסות שוב.',
    installHint:
      'לקבלת התראות בטלפון: פתח את האתר בכרום, בחר בתפריט "הוספה למסך הבית", ואז הפעל את ההתראות מתוך האפליקציה.',
    timezone: 'אזור זמן',
    dailyHour: 'תזכורת יומית בשעה',
    missedHour: 'תזכורת אם לא נמדד היום, בשעה',
    off: 'כבוי',
    test: 'שלח התראת בדיקה',
    testSent: 'ההתראה נשלחה. אמורה להופיע תוך שניות.',
    testNoDevice:
      'לא נמצא מכשיר רשום. כבה את ההתראות והפעל אותן מחדש, ואז נסה שוב.',
    testFailed: 'שליחת התראת הבדיקה נכשלה:',
    statusTitle: 'מצב ההתראות',
    statusPermission: 'הרשאת הדפדפן',
    statusSubscription: 'רישום המכשיר',
    permGranted: 'אושרה',
    permDenied: 'נחסמה',
    permDefault: 'טרם נתבקשה',
    subActive: 'רשום',
    subNone: 'לא רשום',
    subStale: 'רישום ישן — יש להפעיל מחדש',
    staleWarning:
      'מפתחות ההתראות התחלפו, ולכן הרישום הקיים אינו תקף. כבה את ההתראות והפעל אותן מחדש.',
    save: 'שמירת הגדרות',
    saved: 'ההגדרות נשמרו',
    signOut: 'התנתקות',
  },

  push: {
    dailyTitle: 'מעקב לחץ דם',
    dailyBody: 'הגיע הזמן למדוד לחץ דם',
    missedTitle: 'מעקב לחץ דם',
    missedBody: 'לא נרשמה מדידה היום',
  },

  common: {
    loading: 'טוען…',
    error: 'משהו השתבש. נסה שוב.',
    configMissing:
      'חסרה הגדרת חיבור ל-Supabase. יש למלא את VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.',
  },
} as const
