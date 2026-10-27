// داده‌ی اولیه‌ی صفحه (دقیقاً همان متن‌هایی که در HTML اصلی بود)
const IMG_AVATAR = './img/img-dr.png';
const IMG_NATURE = './img/nature.jpg';

export const AVATAR_SRC = IMG_AVATAR;

export function createInitialItems() {
    return [
        {
            id: 'initial-card',
            kind: 'card',
            userName: "ستایش قبادی",
            status: 'unconfirmed',
            replyTo: {"user":"علیرضا گودرزی","text":"این مورد باید به صورت تفصیلی گزارش برای آن ثبت شود"},
            blocks: [
                { type: 'text', text: "این مورد باید به صورت تفصیلی گزارش برای آن ثبت شود" },
                { type: 'text', text: "تحقیقات  در این زمینه با توجه به عکس زیر می‌تواند کمک کننده باشد تحقیقات من در این زمینه با توجه به عکس زیر می‌تواند کمک کننده باشد تحقیقات من در این زمینه با توجه به عکس زیر می‌تواند کمک کننده باشد" },
            ],
        },
        {
            id: 'initial-text',
            kind: 'text',
            userName: "علیرضا گودرزی",
            status: 'unconfirmed',
            blocks: [
                { type: 'text', text: "این مورد باید به صورت تفصیلی گزارش برای آن ثبت شود" },
                { type: 'text', text: "تحقیقات  در این زمینه با توجه به عکس زیر می‌تواند کمک کننده باشد تحقیقات من در این زمینه با توجه به عکس زیر می‌تواند کمک کننده باشد تحقیقات من در این زمینه با توجه به عکس زیر می‌تواند کمک کننده باشد" },
                { type: 'image', src: IMG_NATURE },
                { type: 'text', text: "تحقیقات به صورت انفرادی انجام شد" },
            ],
        },
        {
            id: 'initial-voice',
            kind: 'voice',
            userName: "ستایش قبادی",
            status: 'confirmed',
            timeText: "دو هفته پیش",
            blocks: [],
            voice: { duration: 201, peaks: null, audio: null, url: null, filename: null },
        },
    ];
}
