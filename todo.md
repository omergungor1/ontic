Bir Trendyol Crm geliştiriyoruz. Genel akış şöyle:

Eklediğin örnek trendyol veri çekme sayfasını kaldır. 

İki adet panel olacak. Admin ve üretici paneli. Tüm ekranlar tamamen responsive olmalıdır. Özellikle telefondan çok rahat kullanılabilmelidir.

Supabase auth, storage ve supa psql tablo kullanacağız. 

Trendyol ürünler ve siparişleri bizde tabloda tutacağız. Ara sıra güncelleme yapacağız. Apiden gelen yanıtı ekledim ana dizinde @products.json ve @orders.json -> incele ve doğru tablo yapısını oluştur.

Ana sayfa SPA tanıtım sayfası olacaktır. 
Landing Page
- ONTİC Nasıl çalışır, Biz kimiz, Hakkımızda vs. | SPA tanıtım -> örnek bir landing page oluştur sonra ana sayfayı güncelleyeceğiz.
- Üretici Kayıt formu -> ana sayfaya üretici misiniz hemen kayıt oluşturun section -> Kadın üreticileri destekliyoruz vs. Ontic ailesine katılın vs... -> buton ile kayıt formu açıldı -> (Ad-Soyad, Telefon(unique), Şehir, İlçe) -> Gerekli bilgileri alınca Kaydet -> Talebiniz başarıyla oluşturuldu en kısa sürede size dönüş sağlayacağız. İlginiz için teşekkürler vs. 


Admin Panel:
- Sipariş Yönetimi (Trendyoldan api ile siparişleri çek veya el ile ekle) (el ile manuel sipariş ekleme özelliği de olsun. Gerekirse ek ile ürün ve adet seçip kendi manuel sipariş ekleyebilsin.) -> Gelen siparişler ve Üretici siparişleri iki sipariş ekranı olacak. -> siparişi üreticilerin ellerindeki stoklara göre üreticilere paylaştır (Bir veya birden fazla üreticiye bir sipariş pay edilebilir.) -> Her pay edilen üretici siparişlerinin durum takibi ve kargo kod resim yükleme alanı bulunmalıdır. -> Fiyat ödeme bilgisi vs. gözükebilir...
- Ürün Tanımlama (el ile manuel sipariş ekleme özelliği de olsun. Gerekirse el ile ürün ekleyebilsin admin) -> Trendyol api ile tüm ürünleri çek, aktif pasif vs senkron et -> Yeni ürün varsa ekle silinmişse vs bizde de silinen ürünlere kaldırabilirsin. -> trendyol ürünler ile sync edeceksin. 
- Üretici Yönetimi (Ekle, sil, güncelle -> şifre yenileme) -> Tüm ürünlerimden hangilerini ürettiğini seçiyorum bu üretici (Her üretici istediği ürünü üretemez ben ona ekleyip açıyorum.)
- Stok Takip (Elimde stoğu olan ürünler) -> Üretici bazlı: Hangi üreticide kaç stok var, elle güncelleme özelliği...
- Kasa Yönetimi (Ödemeleri kaydet - Gelir gider dengesi) -> Gelirler(Siparişlerin geliri), Ödemeler (Üreticilere yapılan manuel ödemeler +ödeme ile el ile giriliyor) -> Gelir gider dengesini göster, üste tarih ve gerekli filtreleri ekle
- Mesajlaşma (Tüm üreticiler ile mesajlaşma ekranı) -> Aynı whatsapp gibi. + ile Resim gönderme ve metin mesaj gönderme özellikleri olacak. +Yeni Mesaj ile yeni bir üretici ile mesajlaşma yapılabilir. İnfinite scroll ile son 20 mesaj, scroll ettikçe daha eski mesajlar yüklenmelidir.

Üretici Panel:
- Ana sayfa -> Okunmamış yenş mesaj var mı? varsa tıklayınca mesajlaşma sekmesine gönder. Yeni sipariş var mı(tamamlandı ve iptal dışındaki üretici üzerindeki siparişleri kart olarak göster, tıklayınca sipariş detay sayfasını açsın),Toplam stok adedi(Tıklayınca Ürün ve stok sayfasına gidecek), Kalan ödeme bilgisi(Tıkalayınca ödemeler sayfasına gidecek)
- Ürün ve Stok (Adminin sana üretmeni istediği ürünler listesi, Elindeki hazır stok yönetim) -> 
- Siparişler (Sipariş: Elinde 2 ürün var 3 eksik var... -> kargo kodu görüntüsü) İnfinite scroll ile eskiye doğru tüm sipariş listesi. Sipariş tarihi, bu siparişten alacağı fiyat gibi bilgiler yazsın. Tıklayınca sipariş detayı açılsın -> hangi ürünler kaç adet, alacağın ödeme, kargo kod resmi, sipariş durumu gibi.
- Ödemeler (Alacak dengesi)-> En üstte kaç tl alacağı kaldı ise o yazacak -> altta timeline olarak (infinite scroll ile son 20 kayıt çeke çeke) ödeme ve satış listesini göster(Satış 214₺, Ödeme Aldınız 2000₺ gibi...)
- Mesajlaşma -> sadece admin ile mesajlaşma ekranı -> okunmamış mesaj varsa mesajlaşma kısmında kırmızı nokta ile mesajı göster. infinite scroll ile son 20 mesaj, scroll ettikçe daha eski mesajlar yüklenmelidir.


Admin panelde Siparişler sekmesi > Trendyoldan siparişi üstte senkronizasyon butonu ile sync edeceğiz. Trendyol hesabımızdaki siparişler kendi ekranımda siparişler kısmına düşecek.( El ile manuel sipariş de ekleyebilmeliyim. ) -> Trendyol apiden sipariş edilen ürün, adet, varsa saış fiyatı, varsa trendyol kesintisi hariç kalan miktar sipariş detaylarına düşecek. Siparişlerin durumları olmalı (Trendyol durumu gösterilecek) -> Sipariş üreticilere pay edilecek (Bir veya birden fazla üretici seçilerek hangi ürünü hangi üretici kaç adet gönderecek diye - Sipariş ürün üzerine tıklayınca bunu üreten üretici listesi çıksın, elinde bu ürün stoğu olan üreticiler en üstte çıkacak) -> üretici seçip kaç adet verecek girilecek (Kolayca + - ve tümü ile seçilebilsin) -> tüm sipariş ürünleri hangi üreticilerden gönderim yapılacaksa tek tek seçilmeli ve sipariş iç durumu güncellenecektir. trendyol_orders ve producer_orders gibi iki ayrı orders tablosu tutmalıyız. Alt siparişleri tutan producer_orders tablosunda da durum alanı olmalı (oluşturuldu,iptal edildi, tamamlandı vs.)

Admin_emails envirement variable ekleyelim. Admin mailleri giriş yapınca admin panele, diğerleri giriş yapınca üretici paneli açılacak. Üretici paneli daha sade, kullanımı çok kolay ve anlaşılır olmalı. Metinler okunaklı ve büyük telefondan çok rahat okunabilecek bir arayüz olmalıdır. 



Ana dizine products.json ve orders.json iki dosya ekledim. Onları incele trendyol apiden bu şekilde ürün ve sipariş geliyor. apiden gelen ürün görsellerini ürün kartlarındaç gösterelim bizde.


Tüm ürün ve siparişleri trendyoldan çekip bizim veri tabanına basmalı, tekrar sync edince güncellemelisin gerekiyorsa. 


Üretici ekleme : admin el ile manuel üretici ekleyebilmelidir. username(eşsiz mi kontrol edilmeli eklerken), ad soyad, şehir ve şifre ile üretici ekler. Mail onaya gerek yok, supa auth oto eklesin. Ayrıca üretici iban, şehir, ilçe, not(sadece admin görecek) gibi bilgileri üretici detay ekranında doldurabilmelidir. 


Admin mail ile giriş yapacaktır -> iki admin kullanıcımız var (onticbursa@gmail.com ve omergungorco@gmail.com)

Üreticiler username+password ile giriş yapacaktır -> Domainimiz ontic.com.tr -> username eşsiz olmalıdır. örn: halimederin username olsun. Arka planda giriş yapınca halimederin@ontic.com.tr şeklinde username mail gibi kullanalım. Üretici giriş ekranı çok sade ve anlaşılır olmalıdır. Üretici giriş yaparken hata alırsa giriş yapamıyorsanız lütfen whatsapp üzerinden iletişime geçiniz yazabilir. -> forgatpassword vs olmasın gerek yok. Sign up form olmayacak tüm kullanıcılar admin panelden manuel eklenecektir. Kullanıcı eklerken şifresini görelim ve bir alana şifreyi çözebilecek bir şifreleme ile şifreli pasword yazalım. Daha sonra tekrar şifre görüntülemek gerekebilir ancak db de şifreleri crypte edilmeden tutmayalım. Admin üretici detay ekranında şifre görüntüle seçeneği ile kullanıcı şifresini veri tabanındaki hash edilmiş şifreyi geri çözdürüp görüntüleyebilsin.






Örnek Proje akışı:
- Admin üreticileri ekledi
- Admin tüm ürün listesini supabase deki ürünler tablosu ile eşledi. 

- Admin üreticilere hangi ürünleri yapacaksa onları aktif etti -> swich ile başta tümü pasif, istediklerini aktif ediyor. Aktif edilenler en üstte çıksın üretici ayar sayfasında. 


- Admin sync butonu ile trendyoldan siparişleri çekti
- Sipariş yeni oluştu -> Siparişi dağıtması gerekiyor
- Siparişi üreticilerden elinde stok olan veya olmayan seçtiği üreticilere dağıttı (O ürünü hangi üreticiler üretiyorsa onlar içinden seçmesi gerekiyor. Elinde stok bulunmak zorunda değil yine de seçebilir o üreticiyi)
- Üreticiler için ayrı ayrı sipariş kargo kodlarını yükledi
- Üretici siparişi oluşturuldu
- Üretici siparişi üretici tarafından onaylandı (ürün listesi kaç adet isteniyor, üretici stoğunda eksik varsa 2 adet stok eksik ile göster eksikleri) -> Hazır işaretlendi -> Kargolandı işaretlendi
- Siparişler iptal edilebilir -> Trendyol_orders ve producer_orders ikisi de iptal edilebilir. Bir Sipariş tekrar pay edilebilir -> Siparişe tıklayınca producer_orders listelenecek. İptal et seçeneği olsun. İptal edince eksik kalan ürünler olacak onları tekrar başkasına sipariş olaran producer_orders olarak ekleyebilmelidir. 
- Üretici kargo koduna tıkladı kargo resmini  görüntüledi ve kargolandı diyerek siparişi tamamladı. 

- Admin belli aralıklarla ödeme ekliyor -> kullanıcı seç ödeme gir

- Üretici ödemeler sekmesinde gelen ödemeler ve tarihleri görüntüleyebiliyor.

/public/logo.png -> logoyu koydum kullanabilirsin.


Supabase mcp bağlı -> gerekli tabloları ekle ve gerekli RLS ayarlarını yapmalısın. Trendyol apileri kesinlikle ön yüzde kullanma! trendyol apiler yanlızca admin kullanıcılar kullanabilir.



.env.local içine gerekli api keyleri ekledim:

TRENDYOL_SATICI_ID
TRENDYOL_ENTEGIRASYON_REFERANS_NUMARASI
TRENDYOL_API_KEY
TRENDYOL_API_SECRET
TRENDYOL_TOKEN

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
