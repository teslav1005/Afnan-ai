const photos = [
  ['images/mahmoud-01.jpg','صورة محمود سعد'],
  ['images/mahmoud-02.jpg','صورة شخصية لمحمود'],
  ['images/mahmoud-03.jpg','لقطة من ألبوم محمود'],
  ['images/mahmoud-04.jpg','صورة شخصية لمحمود'],
  ['images/mahmoud-05.jpg','ذكرى شخصية'],
  ['images/mahmoud-06.jpg','صورة تذكارية'],
  ['images/mahmoud-07.jpg','صورة من الذكريات'],
  ['images/mahmoud-08.jpg','صورة شخصية لمحمود'],
];

const photoGrid = document.getElementById('photoGrid');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightbox = document.getElementById('closeLightbox');

photos.forEach(([src, alt], index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', `عرض ${alt}`);
  button.innerHTML = `<img src="${src}" alt="${alt}" loading="lazy"><span>${String(index + 1).padStart(2, '0')}</span>`;
  button.addEventListener('click', () => {
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  });
  photoGrid.appendChild(button);
});

function closeGallery() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}
closeLightbox.addEventListener('click', closeGallery);
lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closeGallery(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeGallery(); });

const menuBtn = document.getElementById('menuBtn');
const mobileNav = document.getElementById('mobileNav');
menuBtn.addEventListener('click', () => {
  const isOpen = mobileNav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(isOpen));
  menuBtn.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
});
document.querySelectorAll('#mobileNav a').forEach((link) => link.addEventListener('click', () => {
  mobileNav.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', 'فتح القائمة');
}));
