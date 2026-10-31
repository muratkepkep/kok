export interface GuideItem {
  question: string
  answer: string
  /** Kliniğe danışmayı gerektiren durum. */
  warn?: string
}

export const GUIDE: GuideItem[] = [
  {
    question: 'Yeni ekilen saçlarım dökülüyor, normal mi?',
    answer: 'Çoğu kişide 2. hafta ile 2. ay arasında şok dökülme görülür. Saç teli dökülse de kök deride kalır ve aylar içinde yeni saç çıkar.',
    warn: 'Dökülmeyle birlikte kızarıklık, ağrı veya iltihap varsa kliniğine bildir.',
  },
  {
    question: 'Kaşıntı ne kadar sürer?',
    answer: 'İyileşme ve kabuk dökülmesi sırasında kaşıntı sık görülür. Bölgeyi kaşıma, kliniğinin önerdiği losyon ve yıkama düzenini izle.',
    warn: 'Şiddetli kaşıntı, döküntü veya iltihap varsa kliniğine danış.',
  },
  {
    question: 'Alnımda ve gözlerimde şişlik oluştu',
    answer: 'İlk günlerde özellikle 2-5. günler arasında alında şişlik görülebilir. Başı yüksekte tutmak çoğu zaman yardımcı olur.',
    warn: 'Şişlik artıyorsa, nefes darlığı veya görme sorunu varsa hemen sağlık kuruluşuna başvur.',
  },
  {
    question: 'Kabuklar ne zaman dökülür?',
    answer: 'Kabuklar çoğunlukla 10-14. günlerde dökülür. Elle koparma; düzenli yıkama kabukları yumuşatır.',
    warn: '14. günden sonra hâlâ yoğun kabuk varsa kliniğine fotoğraf gönder.',
  },
  {
    question: 'Sivilce gibi kabarcıklar çıktı',
    answer: 'Yeni saçlar çıkarken follikülit denen küçük kabarcıklar görülebilir. Sıkma ve kurcalama.',
    warn: 'Yaygınsa, ağrılıysa veya iltihaplıysa kliniğine danış; tedavi gerekebilir.',
  },
  {
    question: 'Ekim bölgesinde uyuşma var',
    answer: 'Sinir uçları iyileşirken uyuşma veya karıncalanma haftalar, bazen aylar sürebilir.',
    warn: 'Geçmeyen ağrı veya yayılan uyuşma varsa doktoruna söyle.',
  },
  {
    question: 'Ne zaman sonuç görmeye başlarım?',
    answer: 'Yeni saçlar çoğunlukla 3-4. ayda çıkmaya başlar. Yarısına yakını 6. ayda görülür, sonuç 12. ayda büyük ölçüde yerleşir. Tepe bölgesi 18 aya kadar gelişebilir.',
  },
  {
    question: 'Bir dozu kaçırdım, ne yapmalıyım?',
    answer: 'Kök doz önerisi yapmaz. Prospektüsü ve doktorunun talimatını izle, kaçan dozu kendi başına iki katına çıkarma.',
    warn: 'Çarpıntı, baş dönmesi veya beklenmedik yan etki varsa ilacı kullanan doktoruna hemen bildir.',
  },
  {
    question: 'Minoksidili ne zaman başlamalıyım?',
    answer: 'Başlangıç zamanını klinikler farklı belirler. Doktorunun verdiği tarihi ilaç kaydına gir.',
  },
  {
    question: 'Ne zaman acil yardım almalıyım?',
    answer: 'Yüksek ateş, iltihap ve kötü koku, hızla yayılan kızarıklık, durmayan kanama veya geçmeyen şiddetli ağrı beklenen bir durum değildir.',
    warn: 'Bu durumlarda beklemeden kliniğini ara veya en yakın sağlık kuruluşuna başvur.',
  },
]
