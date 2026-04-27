const { PrismaClient } = require("@prisma/client");
const studyCatalog = require("../src/features/study/lib/study-catalog.json");

const prisma = new PrismaClient();

const skillSeeds = [
  { slug: "analysis",     name: "Аналитика" },
  { slug: "research",     name: "Исследования" },
  { slug: "presentation", name: "Презентации" },
  { slug: "python",       name: "Программирование" },
  { slug: "product",      name: "Управление продуктом" },
  { slug: "design",       name: "Дизайн" },
  { slug: "marketing",    name: "Маркетинг" },
  { slug: "finance",      name: "Финансы" },
  { slug: "frontend",     name: "Фронтенд" },
  { slug: "backend",      name: "Бэкенд разработка" },
  { slug: "ux",           name: "Исследование пользователей" },
  { slug: "copywriting",  name: "Тексты" }
];

const subjectSeeds = [
  ...studyCatalog.subjects.map((subject) => ({
    slug: subject.slug,
    name: subject.name
  })),
  { slug: "statistics", name: "Статистика" },
  { slug: "programming", name: "Программирование" },
  { slug: "finance", name: "Финансы" },
  { slug: "management", name: "Менеджмент" }
];

const now = new Date();
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

function daysFromNow(days) {
  return new Date(now.getTime() + days * dayMs);
}

function hoursFromNow(hours) {
  return new Date(now.getTime() + hours * hourMs);
}

function slots(entries) {
  return entries.map((entry) => ({
    dayOfWeek: entry.day,
    startMinute: entry.start,
    endMinute: entry.end
  }));
}

const users = [
  {
    key: "admin_anna",
    telegramId: 700000001n,
    username: "aperly_admin",
    firstName: "Анна",
    lastName: "Павлова",
    languageCode: "ru",
    role: "ADMIN",
    status: "ACTIVE",
    profile: {
      fullName: "Анна Павлова",
      bio: "Модерирует заявки, репорты и первые команды в Aperly.",
      program: "ba-business-management",
      courseYear: 4,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE", "OFFLINE"],
      preferredRoles: ["PRODUCT_MANAGER", "ANALYST"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@aperly_admin",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 660, end: 840 },
        { day: "THURSDAY", start: 660, end: 840 }
      ])
    },
    skillSlugs: ["analysis", "presentation", "product"],
    subjectSlugs: ["management", "statistics"],
    verifications: [
      { type: "TELEGRAM", status: "VERIFIED" },
      {
        type: "HSE_EMAIL",
        status: "VERIFIED",
        email: "anna.pavlova@hse.ru"
      }
    ]
  },
  {
    key: "ivan_case",
    telegramId: 700000002n,
    username: "ivan_case",
    firstName: "Иван",
    lastName: "Петров",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Иван Петров",
      bio: "Ищу команду для кейсов и люблю структурировать гипотезы.",
      program: "ba-international-business-economics",
      courseYear: 1,
      campus: "HSE Perm",
      preferredFormats: ["HYBRID", "OFFLINE"],
      preferredRoles: ["ANALYST", "PRESENTER"],
      isDiscoverable: true,
      discoverableScenarios: ["CASE", "PROJECT"],
      telegramUsername: "@ivan_case",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 1080, end: 1260 },
        { day: "WEDNESDAY", start: 1080, end: 1260 }
      ])
    },
    skillSlugs: ["analysis", "research", "presentation"],
    subjectSlugs: ["microeconomics", "statistics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "dasha_case",
    telegramId: 700000003n,
    username: "dasha_case",
    firstName: "Дарья",
    lastName: "Титова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Дарья Титова",
      bio: "Делаю презентации и помогаю командам упаковывать идеи.",
      program: "ba-business-management",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["OFFLINE", "HYBRID"],
      preferredRoles: ["DESIGNER", "PRESENTER"],
      isDiscoverable: true,
      discoverableScenarios: ["CASE"],
      telegramUsername: "@dasha_case",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 1140, end: 1320 },
        { day: "THURSDAY", start: 1080, end: 1260 }
      ])
    },
    skillSlugs: ["presentation", "design", "copywriting"],
    subjectSlugs: ["marketing", "management"],
    verifications: [
      { type: "TELEGRAM", status: "VERIFIED" },
      {
        type: "HSE_EMAIL",
        status: "VERIFIED",
        email: "d.titova@edu.hse.ru"
      }
    ]
  },
  {
    key: "nikita_case",
    telegramId: 700000004n,
    username: "nikita_case",
    firstName: "Никита",
    lastName: "Волков",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Никита Волков",
      bio: "Разработчик прототипов, пишу на Python и собираю MVP.",
      program: "ba-software-engineering-business-informatics",
      courseYear: 1,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE", "HYBRID"],
      preferredRoles: ["DEVELOPER", "PRODUCT_MANAGER"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@nikita_case",
      phone: null,
      availability: slots([
        { day: "TUESDAY", start: 1080, end: 1320 },
        { day: "FRIDAY", start: 1020, end: 1260 }
      ])
    },
    skillSlugs: ["python", "frontend", "backend"],
    subjectSlugs: ["programming", "linear-algebra"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "marina_case",
    telegramId: 700000005n,
    username: "marina_case",
    firstName: "Марина",
    lastName: "Ким",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Марина Ким",
      bio: "Помогаю с исследованиями, интервью и аналитикой.",
      program: "ba-business-management",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["OFFLINE"],
      preferredRoles: ["RESEARCHER", "ANALYST"],
      isDiscoverable: true,
      discoverableScenarios: ["CASE", "STUDY"],
      telegramUsername: "@marina_case",
      phone: null,
      availability: slots([
        { day: "WEDNESDAY", start: 1020, end: 1200 },
        { day: "SATURDAY", start: 720, end: 900 }
      ])
    },
    skillSlugs: ["research", "analysis", "marketing"],
    subjectSlugs: ["marketing", "statistics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "artem_project",
    telegramId: 700000006n,
    username: "artem_project",
    firstName: "Артем",
    lastName: "Орлов",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Артем Орлов",
      bio: "Запускаю продуктовые гипотезы и ищу сильную проектную команду.",
      program: "ba-software-engineering-business-informatics",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE", "HYBRID"],
      preferredRoles: ["PRODUCT_MANAGER", "DEVELOPER"],
      isDiscoverable: true,
      discoverableScenarios: ["PROJECT"],
      telegramUsername: "@artem_project",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 1140, end: 1320 },
        { day: "THURSDAY", start: 1140, end: 1320 }
      ])
    },
    skillSlugs: ["product", "analysis", "backend"],
    subjectSlugs: ["product-management", "entrepreneurship"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "olga_project",
    telegramId: 700000007n,
    username: "olga_project",
    firstName: "Ольга",
    lastName: "Семенова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Ольга Семенова",
      bio: "Разбираюсь в рынке и умею проверять спрос.",
      program: "ba-business-management",
      courseYear: 3,
      campus: "HSE Perm",
      preferredFormats: ["HYBRID", "ONLINE"],
      preferredRoles: ["MARKETER", "ANALYST"],
      isDiscoverable: true,
      discoverableScenarios: ["PROJECT"],
      telegramUsername: "@olga_project",
      phone: null,
      availability: slots([
        { day: "TUESDAY", start: 1080, end: 1260 },
        { day: "FRIDAY", start: 1080, end: 1260 }
      ])
    },
    skillSlugs: ["marketing", "analysis", "copywriting"],
    subjectSlugs: ["marketing", "management"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "sergey_project",
    telegramId: 700000008n,
    username: "sergey_project",
    firstName: "Сергей",
    lastName: "Федоров",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Сергей Федоров",
      bio: "Пишу backend и помогаю переводить идеи в рабочие сервисы.",
      program: "ba-software-engineering-business-informatics",
      courseYear: 3,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE"],
      preferredRoles: ["DEVELOPER", "PRODUCT_MANAGER"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@sergey_project",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 1200, end: 1380 },
        { day: "THURSDAY", start: 1200, end: 1380 }
      ])
    },
    skillSlugs: ["backend", "python", "product"],
    subjectSlugs: ["programming", "product-management"],
    verifications: [
      { type: "TELEGRAM", status: "VERIFIED" },
      {
        type: "HSE_EMAIL",
        status: "PENDING",
        email: "sergey.fedorov@edu.hse.ru"
      }
    ]
  },
  {
    key: "polina_project",
    telegramId: 700000009n,
    username: "polina_project",
    firstName: "Полина",
    lastName: "Крылова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Полина Крылова",
      bio: "Люблю маркетинг, исследования и понятную упаковку проектов.",
      program: "ma-public-municipal-management",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["HYBRID", "OFFLINE"],
      preferredRoles: ["MARKETER", "RESEARCHER"],
      isDiscoverable: true,
      discoverableScenarios: ["PROJECT", "STUDY"],
      telegramUsername: "@polina_project",
      phone: null,
      availability: slots([
        { day: "WEDNESDAY", start: 1080, end: 1260 },
        { day: "SUNDAY", start: 720, end: 900 }
      ])
    },
    skillSlugs: ["marketing", "research", "presentation"],
    subjectSlugs: ["management", "entrepreneurship"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "lena_study",
    telegramId: 700000010n,
    username: "lena_study",
    firstName: "Елена",
    lastName: "Захарова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Елена Захарова",
      bio: "Ищу понятный ритм учебы и партнера для регулярных встреч.",
      program: "ba-international-business-economics",
      courseYear: 1,
      campus: "HSE Perm",
      preferredFormats: ["OFFLINE", "ONLINE"],
      preferredRoles: ["ANALYST"],
      isDiscoverable: true,
      discoverableScenarios: ["STUDY"],
      telegramUsername: "@lena_study",
      phone: null,
      availability: slots([
        { day: "TUESDAY", start: 1020, end: 1200 },
        { day: "THURSDAY", start: 1080, end: 1260 }
      ])
    },
    skillSlugs: ["analysis", "research"],
    subjectSlugs: ["statistics", "microeconomics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "misha_study",
    telegramId: 700000011n,
    username: "misha_study",
    firstName: "Михаил",
    lastName: "Егоров",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Михаил Егоров",
      bio: "Хочу вместе разбирать задачи и готовиться без авралов.",
      program: "ba-international-business-economics",
      courseYear: 1,
      campus: "HSE Perm",
      preferredFormats: ["OFFLINE"],
      preferredRoles: ["ANALYST", "RESEARCHER"],
      isDiscoverable: true,
      discoverableScenarios: ["STUDY"],
      telegramUsername: "@misha_study",
      phone: null,
      availability: slots([
        { day: "TUESDAY", start: 1080, end: 1260 },
        { day: "THURSDAY", start: 1080, end: 1260 }
      ])
    },
    skillSlugs: ["analysis", "presentation"],
    subjectSlugs: ["statistics", "macroeconomics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "katya_study",
    telegramId: 700000012n,
    username: "katya_study",
    firstName: "Екатерина",
    lastName: "Морозова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Екатерина Морозова",
      bio: "Мне комфортнее учиться вместе перед семинарами.",
      program: "ba-international-business-economics",
      courseYear: 1,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE"],
      preferredRoles: ["ANALYST"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@katya_study",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 900, end: 1080 },
        { day: "FRIDAY", start: 900, end: 1080 }
      ])
    },
    skillSlugs: ["analysis"],
    subjectSlugs: ["microeconomics", "statistics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "timur_study",
    telegramId: 700000013n,
    username: "timur_study",
    firstName: "Тимур",
    lastName: "Власов",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Тимур Власов",
      bio: "Хочу подтянуть программирование через практику и объяснение.",
      program: "ba-software-engineering-business-informatics",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE"],
      preferredRoles: ["DEVELOPER"],
      isDiscoverable: true,
      discoverableScenarios: ["STUDY", "PROJECT"],
      telegramUsername: "@timur_study",
      phone: null,
      availability: slots([
        { day: "WEDNESDAY", start: 1140, end: 1320 },
        { day: "SUNDAY", start: 840, end: 1020 }
      ])
    },
    skillSlugs: ["python", "backend", "frontend"],
    subjectSlugs: ["programming", "linear-algebra"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "vera_discoverable",
    telegramId: 700000014n,
    username: "vera_open",
    firstName: "Вера",
    lastName: "Соколова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Вера Соколова",
      bio: "Помогаю с дизайном, упаковкой и визуальной частью проектов.",
      program: "ba-creative-industries-management",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["HYBRID"],
      preferredRoles: ["DESIGNER", "MARKETER"],
      isDiscoverable: true,
      discoverableScenarios: ["PROJECT", "CASE"],
      telegramUsername: "@vera_open",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 1080, end: 1260 },
        { day: "SATURDAY", start: 780, end: 960 }
      ])
    },
    skillSlugs: ["design", "ux", "marketing"],
    subjectSlugs: ["marketing", "management"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "roman_discoverable",
    telegramId: 700000015n,
    username: "roman_open",
    firstName: "Роман",
    lastName: "Васильев",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Роман Васильев",
      bio: "Могу подключиться как разработчик и аналитик в проектную команду.",
      program: "ba-software-engineering-business-informatics",
      courseYear: 3,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE", "HYBRID"],
      preferredRoles: ["DEVELOPER", "ANALYST"],
      isDiscoverable: true,
      discoverableScenarios: ["PROJECT", "STUDY"],
      telegramUsername: "@roman_open",
      phone: null,
      availability: slots([
        { day: "TUESDAY", start: 1140, end: 1320 },
        { day: "FRIDAY", start: 1140, end: 1320 }
      ])
    },
    skillSlugs: ["backend", "analysis", "python"],
    subjectSlugs: ["programming", "statistics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "sonya_mixed",
    telegramId: 700000016n,
    username: "sonya_mixed",
    firstName: "Соня",
    lastName: "Белова",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Соня Белова",
      bio: "Мне нравится исследовать идеи, роли пользователей и продуктовые гипотезы.",
      program: "ba-business-management",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["OFFLINE", "HYBRID"],
      preferredRoles: ["RESEARCHER", "PRODUCT_MANAGER"],
      isDiscoverable: true,
      discoverableScenarios: ["CASE", "PROJECT", "STUDY"],
      telegramUsername: "@sonya_mixed",
      phone: null,
      availability: slots([
        { day: "MONDAY", start: 1020, end: 1200 },
        { day: "THURSDAY", start: 1020, end: 1200 }
      ])
    },
    skillSlugs: ["research", "product", "marketing"],
    subjectSlugs: ["management", "statistics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "egor_mixed",
    telegramId: 700000017n,
    username: "egor_mixed",
    firstName: "Егор",
    lastName: "Лебедев",
    languageCode: "ru",
    role: "USER",
    status: "ACTIVE",
    profile: {
      fullName: "Егор Лебедев",
      bio: "Считаю финансы и помогаю довести решение до логики.",
      program: "ba-international-business-economics",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["OFFLINE"],
      preferredRoles: ["FINANCE", "ANALYST"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@egor_mixed",
      phone: null,
      availability: slots([
        { day: "WEDNESDAY", start: 1140, end: 1320 },
        { day: "SATURDAY", start: 780, end: 960 }
      ])
    },
    skillSlugs: ["finance", "analysis", "presentation"],
    subjectSlugs: ["finance", "statistics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "alina_blocked",
    telegramId: 700000018n,
    username: "alina_blocked",
    firstName: "Алина",
    lastName: "Смирнова",
    languageCode: "ru",
    role: "USER",
    status: "BLOCKED",
    blockedAt: hoursFromNow(-36),
    profile: {
      fullName: "Алина Смирнова",
      bio: "Тестовый заблокированный пользователь для модерации.",
      program: "ba-business-management",
      courseYear: 1,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE"],
      preferredRoles: ["MARKETER"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@alina_blocked",
      phone: null,
      availability: slots([{ day: "MONDAY", start: 1080, end: 1200 }])
    },
    skillSlugs: ["marketing", "copywriting"],
    subjectSlugs: ["marketing"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "pavel_deleted",
    telegramId: 700000019n,
    username: "pavel_deleted",
    firstName: "Павел",
    lastName: "Никин",
    languageCode: "ru",
    role: "USER",
    status: "DELETED",
    deletedAt: hoursFromNow(-120),
    profile: {
      fullName: "Павел Никин",
      bio: "Тестовый удаленный профиль, не участвует в подборе.",
      program: "ba-international-business-economics",
      courseYear: 2,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE"],
      preferredRoles: ["ANALYST"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@pavel_deleted",
      phone: null,
      availability: slots([{ day: "FRIDAY", start: 1020, end: 1140 }])
    },
    skillSlugs: ["analysis"],
    subjectSlugs: ["microeconomics"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  },
  {
    key: "nina_inactive",
    telegramId: 700000020n,
    username: "nina_inactive",
    firstName: "Нина",
    lastName: "Орлова",
    languageCode: "ru",
    role: "USER",
    status: "INACTIVE",
    profile: {
      fullName: "Нина Орлова",
      bio: "Сейчас не ищет команду, но профиль остается для истории.",
      program: "ba-international-business-economics",
      courseYear: 3,
      campus: "HSE Perm",
      preferredFormats: ["ONLINE"],
      preferredRoles: ["FINANCE"],
      isDiscoverable: false,
      discoverableScenarios: [],
      telegramUsername: "@nina_inactive",
      phone: null,
      availability: slots([{ day: "THURSDAY", start: 960, end: 1080 }])
    },
    skillSlugs: ["finance", "analysis"],
    subjectSlugs: ["finance"],
    verifications: [{ type: "TELEGRAM", status: "VERIFIED" }]
  }
];

const requests = [
  {
    key: "ivan_case_request",
    ownerKey: "ivan_case",
    scenario: "CASE",
    notes: "Нужен аналитик или дизайнер, чтобы закрыть роли перед дедлайном.",
    expiresAt: daysFromNow(14),
    availability: slots([
      { day: "MONDAY", start: 1080, end: 1260 },
      { day: "WEDNESDAY", start: 1080, end: 1260 }
    ]),
    details: {
      type: "CASE",
      eventName: "Changellenge Cup",
      deadline: daysFromNow(10),
      neededRoles: ["ANALYST", "DESIGNER"],
      teamGapSize: 2,
      preferredFormat: "HYBRID"
    }
  },
  {
    key: "dasha_case_request",
    ownerKey: "dasha_case",
    scenario: "CASE",
    notes: "Ищу команду, где нужна презентация и упаковка идеи.",
    expiresAt: daysFromNow(14),
    availability: slots([
      { day: "MONDAY", start: 1140, end: 1320 },
      { day: "THURSDAY", start: 1080, end: 1260 }
    ]),
    details: {
      type: "CASE",
      eventName: "Changellenge Cup",
      deadline: daysFromNow(10),
      neededRoles: ["PRESENTER", "DESIGNER"],
      teamGapSize: 1,
      preferredFormat: "OFFLINE"
    }
  },
  {
    key: "nikita_case_request",
    ownerKey: "nikita_case",
    scenario: "CASE",
    notes: "Готов закрыть техническую часть и помочь с быстрым прототипом.",
    expiresAt: daysFromNow(9),
    availability: slots([
      { day: "TUESDAY", start: 1080, end: 1320 },
      { day: "FRIDAY", start: 1020, end: 1260 }
    ]),
    details: {
      type: "CASE",
      eventName: "Хакатон по цифровым продуктам",
      deadline: daysFromNow(6),
      neededRoles: ["PRODUCT_MANAGER", "DESIGNER"],
      teamGapSize: 2,
      preferredFormat: "ONLINE"
    }
  },
  {
    key: "marina_case_request",
    ownerKey: "marina_case",
    scenario: "CASE",
    notes: "Помогу быстро провести интервью и customer interviews.",
    expiresAt: daysFromNow(12),
    availability: slots([
      { day: "WEDNESDAY", start: 1020, end: 1200 },
      { day: "SATURDAY", start: 720, end: 900 }
    ]),
    details: {
      type: "CASE",
      eventName: "Case Battle Perm",
      deadline: daysFromNow(8),
      neededRoles: ["RESEARCHER", "ANALYST"],
      teamGapSize: 2,
      preferredFormat: "OFFLINE"
    }
  },
  {
    key: "egor_case_request",
    ownerKey: "egor_mixed",
    scenario: "CASE",
    notes: "Подключусь как финансовый аналитик или презентатор.",
    expiresAt: daysFromNow(11),
    availability: slots([
      { day: "WEDNESDAY", start: 1140, end: 1320 },
      { day: "SATURDAY", start: 780, end: 960 }
    ]),
    details: {
      type: "CASE",
      eventName: "Case Battle Perm",
      deadline: daysFromNow(8),
      neededRoles: ["FINANCE", "ANALYST"],
      teamGapSize: 1,
      preferredFormat: "OFFLINE"
    }
  },
  {
    key: "artem_project_request",
    ownerKey: "artem_project",
    scenario: "PROJECT",
    notes: "Хочу собрать команду для студенческого сервиса и проверить гипотезу.",
    expiresAt: daysFromNow(21),
    availability: slots([
      { day: "MONDAY", start: 1140, end: 1320 },
      { day: "THURSDAY", start: 1140, end: 1320 }
    ]),
    details: {
      type: "PROJECT",
      projectTitle: "Студенческий планировщик задач",
      shortDescription: "MVP-сервис для поиска учебных напарников.",
      stage: "IDEA",
      neededRoles: ["DEVELOPER", "DESIGNER"],
      expectedCommitment: "PART_TIME",
      preferredFormat: "ONLINE"
    }
  },
  {
    key: "olga_project_request",
    ownerKey: "olga_project",
    scenario: "PROJECT",
    notes: "Есть сильная маркетинговая часть, нужен человек на продукт и аналитику.",
    expiresAt: daysFromNow(21),
    availability: slots([
      { day: "TUESDAY", start: 1080, end: 1260 },
      { day: "FRIDAY", start: 1080, end: 1260 }
    ]),
    details: {
      type: "PROJECT",
      projectTitle: "Маркетинговый помощник",
      shortDescription: "Сервис подбора каналов и креативов.",
      stage: "MVP",
      neededRoles: ["MARKETER", "ANALYST"],
      expectedCommitment: "LIGHT",
      preferredFormat: "HYBRID"
    }
  },
  {
    key: "sergey_project_request",
    ownerKey: "sergey_project",
    scenario: "PROJECT",
    notes: "Есть прототип, нужна помощь продуктового человека и маркетолога.",
    expiresAt: daysFromNow(18),
    availability: slots([
      { day: "MONDAY", start: 1200, end: 1380 },
      { day: "THURSDAY", start: 1200, end: 1380 }
    ]),
    details: {
      type: "PROJECT",
      projectTitle: "Платформа по учебным проектам",
      shortDescription: "Продукт для студентов вокруг проектных команд.",
      stage: "MVP",
      neededRoles: ["PRODUCT_MANAGER", "MARKETER"],
      expectedCommitment: "HEAVY",
      preferredFormat: "ONLINE"
    }
  },
  {
    key: "polina_project_request",
    ownerKey: "polina_project",
    scenario: "PROJECT",
    notes: "Ищу технаря или дизайнера, чтобы быстро собрать и проверить.",
    expiresAt: daysFromNow(19),
    availability: slots([
      { day: "WEDNESDAY", start: 1080, end: 1260 },
      { day: "SUNDAY", start: 720, end: 900 }
    ]),
    details: {
      type: "PROJECT",
      projectTitle: "Кампусные полезные сервисы",
      shortDescription: "Понятная карта университетских сервисов для студентов.",
      stage: "EARLY_TRACTION",
      neededRoles: ["MARKETER", "DESIGNER"],
      expectedCommitment: "PART_TIME",
      preferredFormat: "HYBRID"
    }
  },
  {
    key: "sonya_project_request",
    ownerKey: "sonya_mixed",
    scenario: "PROJECT",
    notes: "Хочу протестировать идею с командой и исследованием.",
    expiresAt: daysFromNow(22),
    availability: slots([
      { day: "MONDAY", start: 1020, end: 1200 },
      { day: "THURSDAY", start: 1020, end: 1200 }
    ]),
    details: {
      type: "PROJECT",
      projectTitle: "Помощник по кейсам для команд",
      shortDescription: "Сервис помогает найти роли для кейса и собрать план подготовки.",
      stage: "IDEA",
      neededRoles: ["DEVELOPER", "ANALYST"],
      expectedCommitment: "FLEXIBLE",
      preferredFormat: "OFFLINE"
    }
  },
  {
    key: "lena_study_request",
    ownerKey: "lena_study",
    scenario: "STUDY",
    notes: "Ищу пару, но можно и небольшую группу.",
    expiresAt: daysFromNow(14),
    availability: slots([
      { day: "TUESDAY", start: 1020, end: 1200 },
      { day: "THURSDAY", start: 1080, end: 1260 }
    ]),
    details: {
      type: "STUDY",
      subjectSlug: "statistics",
      currentContext: "Готовлюсь к контрольной по статистике и задачам.",
      goal: "Разобрать типовые задачи и закрыть пробелы.",
      desiredFrequency: "WEEKLY",
      preferredTime: "EVENING",
      preferredFormat: "OFFLINE"
    }
  },
  {
    key: "misha_study_request",
    ownerKey: "misha_study",
    scenario: "STUDY",
    notes: "Хочу регулярно разбирать задачи два раза в неделю.",
    expiresAt: daysFromNow(14),
    availability: slots([
      { day: "TUESDAY", start: 1080, end: 1260 },
      { day: "THURSDAY", start: 1080, end: 1260 }
    ]),
    details: {
      type: "STUDY",
      subjectSlug: "statistics",
      currentContext: "Повторяю темы с выборками и базовой проверкой гипотез.",
      goal: "Решить набор задач вместе и не отложить на ночь.",
      desiredFrequency: "WEEKLY",
      preferredTime: "EVENING",
      preferredFormat: "OFFLINE"
    }
  },
  {
    key: "katya_study_request",
    ownerKey: "katya_study",
    scenario: "STUDY",
    notes: "Мне помогает учебная пара.",
    expiresAt: daysFromNow(10),
    availability: slots([
      { day: "MONDAY", start: 900, end: 1080 },
      { day: "FRIDAY", start: 900, end: 1080 }
    ]),
    details: {
      type: "STUDY",
      subjectSlug: "microeconomics",
      currentContext: "Готовлюсь по микроэкономике.",
      goal: "Разобрать эластичность, равновесие и типовые задачи на графиках.",
      desiredFrequency: "TWICE_WEEKLY",
      preferredTime: "AFTERNOON",
      preferredFormat: "ONLINE"
    }
  },
  {
    key: "timur_study_request",
    ownerKey: "timur_study",
    scenario: "STUDY",
    notes: "Подтянуть Python хочу в группе после 19:00.",
    expiresAt: daysFromNow(16),
    availability: slots([
      { day: "WEDNESDAY", start: 1140, end: 1320 },
      { day: "SUNDAY", start: 840, end: 1020 }
    ]),
    details: {
      type: "STUDY",
      subjectSlug: "programming",
      currentContext: "Много ошибок на задачах с циклами и базовой обработкой данных.",
      goal: "Научиться решать задачи чаще и объяснять решения.",
      desiredFrequency: "TWICE_WEEKLY",
      preferredTime: "EVENING",
      preferredFormat: "ONLINE"
    }
  }
];

function buildUserCreateData(user) {
  return {
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    languageCode: user.languageCode,
    role: user.role,
    status: user.status,
    onboardingCompleted: true,
    blockedAt: user.blockedAt ?? null,
    deletedAt: user.deletedAt ?? null,
    profile: {
      create: {
        fullName: user.profile.fullName,
        bio: user.profile.bio,
        program: user.profile.program,
        courseYear: user.profile.courseYear,
        campus: user.profile.campus,
        preferredFormats: user.profile.preferredFormats,
        preferredRoles: user.profile.preferredRoles,
        isDiscoverable: user.profile.isDiscoverable,
        discoverableScenarios: user.profile.discoverableScenarios,
        telegramUsername: user.profile.telegramUsername,
        phone: user.profile.phone,
        availabilitySlots: {
          create: user.profile.availability
        }
      }
    },
    verifications: {
      create: user.verifications.map((verification) => ({
        type: verification.type,
        status: verification.status,
        email: verification.email ?? null,
        verifiedAt:
          verification.status === "VERIFIED" ? hoursFromNow(-12) : null
      }))
    },
    userSkills: {
      create: user.skillSlugs.map((slug, index) => ({
        level: 3 + (index % 2),
        skill: {
          connect: {
            slug
          }
        }
      }))
    },
    userSubjects: {
      create: user.subjectSlugs.map((slug, index) => ({
        confidence: 3 + (index % 2),
        subject: {
          connect: {
            slug
          }
        }
      }))
    },
    languageSkills: {
      create: (user.languageSkills ?? [{ language: "ENGLISH", level: "B1" }]).map(
        (languageSkill) => ({
          language: languageSkill.language,
          level: languageSkill.level
        })
      )
    }
  };
}

async function createRequest(record, userId) {
  const baseData = {
    owner: {
      connect: {
        id: userId
      }
    },
    scenario: record.scenario,
    status: "ACTIVE",
    notes: record.notes,
    expiresAt: record.expiresAt,
    availabilitySlots: {
      create: record.availability
    }
  };

  if (record.details.type === "CASE") {
    baseData.caseDetails = {
      create: {
        eventName: record.details.eventName,
        deadline: record.details.deadline,
        neededRoles: record.details.neededRoles,
        teamGapSize: record.details.teamGapSize,
        preferredFormat: record.details.preferredFormat
      }
    };
  }

  if (record.details.type === "PROJECT") {
    baseData.projectDetails = {
      create: {
        projectTitle: record.details.projectTitle,
        shortDescription: record.details.shortDescription,
        stage: record.details.stage,
        neededRoles: record.details.neededRoles,
        expectedCommitment: record.details.expectedCommitment,
        preferredFormat: record.details.preferredFormat
      }
    };
  }

  if (record.details.type === "STUDY") {
    baseData.studyDetails = {
      create: {
        subject: {
          connect: {
            slug: record.details.subjectSlug
          }
        },
        currentContext: record.details.currentContext,
        goal: record.details.goal,
        desiredFrequency: record.details.desiredFrequency,
        preferredTime: record.details.preferredTime,
        preferredFormat: record.details.preferredFormat
      }
    };
  }

  return prisma.request.create({
    data: baseData
  });
}

function requestPairKey(leftId, rightId) {
  return `request:${[leftId, rightId].sort().join(":")}`;
}

function fallbackPairKey(requestId, profileId) {
  return `fallback:${requestId}:${profileId}`;
}

async function main() {
  await prisma.adminAction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.session.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.match.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.studyRequestDetails.deleteMany();
  await prisma.projectRequestDetails.deleteMany();
  await prisma.caseRequestDetails.deleteMany();
  await prisma.request.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.userSubject.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.subject.deleteMany();

  await prisma.skill.createMany({
    data: skillSeeds,
    skipDuplicates: true
  });

  await prisma.subject.createMany({
    data: subjectSeeds,
    skipDuplicates: true
  });

  const createdUsers = {};
  const createdProfiles = {};

  for (const user of users) {
    const created = await prisma.user.create({
      data: buildUserCreateData(user),
      include: {
        profile: true
      }
    });

    createdUsers[user.key] = created;
    createdProfiles[user.key] = created.profile;
  }

  const createdRequests = {};

  for (const requestRecord of requests) {
    createdRequests[requestRecord.key] = await createRequest(
      requestRecord,
      createdUsers[requestRecord.ownerKey].id
    );
  }

  const lenaMishaMatch = await prisma.match.create({
    data: {
      pairKey: requestPairKey(
        createdRequests.lena_study_request.id,
        createdRequests.misha_study_request.id
      ),
      scenario: "STUDY",
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      sourceRequestId: createdRequests.lena_study_request.id,
      candidateRequestId: createdRequests.misha_study_request.id,
      score: 91,
      reasonSummary: "Совпадают предмет, время и ритм занятий",
      reasonDetails: {
        subjectFit: "strong",
        availabilityOverlap: "high",
        rhythmFit: "weekly"
      },
      expiresAt: daysFromNow(14)
    }
  });

  await prisma.match.create({
    data: {
      pairKey: requestPairKey(
        createdRequests.ivan_case_request.id,
        createdRequests.dasha_case_request.id
      ),
      scenario: "CASE",
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      sourceRequestId: createdRequests.ivan_case_request.id,
      candidateRequestId: createdRequests.dasha_case_request.id,
      score: 86,
      reasonSummary: "Ищут тот же кейс и закрывают разные роли",
      reasonDetails: {
        roleFit: "presentation",
        eventFit: "same-event",
        formatFit: "hybrid-offline"
      },
      expiresAt: daysFromNow(12)
    }
  });

  const olgaSergeyMatch = await prisma.match.create({
    data: {
      pairKey: requestPairKey(
        createdRequests.olga_project_request.id,
        createdRequests.sergey_project_request.id
      ),
      scenario: "PROJECT",
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      sourceRequestId: createdRequests.olga_project_request.id,
      candidateRequestId: createdRequests.sergey_project_request.id,
      score: 79,
      reasonSummary: "Совпадают формат работы, проектная стадия и навыки",
      reasonDetails: {
        stageFit: "mvp",
        commitmentFit: "light-vs-heavy-needs-review",
        formatFit: "online"
      },
      expiresAt: daysFromNow(18)
    }
  });

  await prisma.match.create({
    data: {
      pairKey: fallbackPairKey(
        createdRequests.artem_project_request.id,
        createdProfiles.vera_discoverable.id
      ),
      scenario: "PROJECT",
      mode: "REQUEST_TO_PROFILE",
      status: "PENDING_RECIPIENT_ACCEPTANCE",
      sourceRequestId: createdRequests.artem_project_request.id,
      candidateProfileId: createdProfiles.vera_discoverable.id,
      score: 62,
      reasonSummary: "Подходит по ролям, дизайну и доступности",
      reasonDetails: {
        discoverableFallback: true,
        formatFit: "hybrid-vs-online",
        skillFit: ["design", "marketing"]
      },
      expiresAt: daysFromNow(14)
    }
  });

  const studyChat = await prisma.chat.create({
    data: {
      matchId: lenaMishaMatch.id,
      userAId: createdUsers.lena_study.id,
      userBId: createdUsers.misha_study.id,
      status: "ACTIVE",
      contactExchangeStatus: "NOT_REQUESTED",
      lastMessageAt: hoursFromNow(-6),
      staleAfterAt: hoursFromNow(66)
    }
  });

  const staleProjectChat = await prisma.chat.create({
    data: {
      matchId: olgaSergeyMatch.id,
      userAId: createdUsers.olga_project.id,
      userBId: createdUsers.sergey_project.id,
      status: "STALE",
      contactExchangeStatus: "NOT_REQUESTED",
      lastMessageAt: hoursFromNow(-82),
      staleAfterAt: hoursFromNow(-10)
    }
  });

  await prisma.message.createMany({
    data: [
      {
        chatId: studyChat.id,
        senderId: createdUsers.lena_study.id,
        type: "USER",
        text: "Привет! Давай во вторник вместе разберем статистику."
      },
      {
        chatId: studyChat.id,
        senderId: createdUsers.misha_study.id,
        type: "USER",
        text: "Отлично, у меня как раз есть вопросы по проверке гипотез."
      },
      {
        chatId: studyChat.id,
        senderId: createdUsers.lena_study.id,
        type: "USER",
        text: "Супер, можно в библиотеке, принесу список задач."
      },
      {
        chatId: staleProjectChat.id,
        senderId: createdUsers.olga_project.id,
        type: "USER",
        text: "Привет! Сможешь обсудить проект на этой неделе?"
      },
      {
        chatId: staleProjectChat.id,
        senderId: createdUsers.sergey_project.id,
        type: "USER",
        text: "Да, давай созвонимся. Мне нужно понять, что уже сделано по продукту."
      }
    ]
  });

  await prisma.session.createMany({
    data: [
      {
        matchId: lenaMishaMatch.id,
        chatId: studyChat.id,
        scheduledByUserId: createdUsers.lena_study.id,
        sequenceNumber: 1,
        scheduledFor: daysFromNow(-7),
        format: "OFFLINE",
        location: "Библиотека HSE Perm",
        notes: "Разобрали вероятности и типовые задачи.",
        status: "COMPLETED",
        nextAction: "SCHEDULE_NEXT",
        confirmedAt: daysFromNow(-8),
        completedAt: daysFromNow(-7)
      },
      {
        matchId: lenaMishaMatch.id,
        chatId: studyChat.id,
        scheduledByUserId: createdUsers.lena_study.id,
        sequenceNumber: 2,
        scheduledFor: daysFromNow(3),
        format: "OFFLINE",
        location: "Аудитория кампуса",
        notes: "Продолжить статистику и разобрать доверительные интервалы.",
        status: "CONFIRMED",
        nextAction: "SCHEDULE_NEXT",
        confirmedAt: hoursFromNow(-20)
      }
    ]
  });

  const resolvedReport = await prisma.report.create({
    data: {
      reporterUserId: createdUsers.polina_project.id,
      targetUserId: createdUsers.alina_blocked.id,
      reasonCode: "INAPPROPRIATE_BEHAVIOR",
      details: "После жалобы проведена проверка поведения.",
      status: "RESOLVED",
      resolvedByAdminId: createdUsers.admin_anna.id,
      resolvedAt: hoursFromNow(-30)
    }
  });

  await prisma.adminAction.create({
    data: {
      adminUserId: createdUsers.admin_anna.id,
      actionType: "BLOCK_USER",
      targetUserId: createdUsers.alina_blocked.id,
      reportId: resolvedReport.id,
      notes: "Подтверждено нарушение правил общения в рабочем диалоге."
    }
  });

  console.log(
    `Seed complete: ${Object.keys(createdUsers).length} users, ${Object.keys(createdRequests).length} requests.`
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
