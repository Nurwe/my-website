const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const expanded = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!expanded));
    nav.style.display = expanded ? 'none' : 'flex';
  });
}

const links = document.querySelectorAll('.site-nav a');
links.forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth <= 680 && nav) {
      nav.style.display = 'none';
      nav.setAttribute('data-open', 'false');
    }
  });
});
