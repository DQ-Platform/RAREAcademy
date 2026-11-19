const programs=[
["🏛️","Dövlət qulluğu","Uğurlu karyera üçün hazırlıq"],["🪖","Səfərbərlik","Vətən xidmətə hazırlıq"],["⚖️","İcra məmuru","Qanunla peşəkar hazırlıq"],["🌍","Miqrasiya","Beynəlxalq imkanlar üçün hazırlıq"],
["🎓","Magistratura","Ali təhsil üçün hazırlıq"],["🛃","Gömrük hazırlığı","Peşəkar bilik, uğurlu karyera"],["📖","Abituriyent","Ali təhsil üçün hazırlıq"],["🗣️","Xarici dillər","Rus, Alman və İngilis dili"],["♟️","Şahmat dərsləri","Strategiya və məntiq"]];
document.getElementById('cards').innerHTML=programs.map(p=>`<a class="card" href="#"><span class="ic">${p[0]}</span><div><b>${p[1]}</b><small>${p[2]}</small></div><i>→</i></a>`).join('');

const slides=[
["Biliklə daha güclü,<br>hədəflərə <em>daha yaxın!</em>","Peşəkar tədris, innovativ yanaşma və uğura aparan düzgün istiqamət – hamısı bir platformada!"],
["Sınaqlarla <em>hazırlığını</em><br>real imtahan formatında yoxla","Hər mövzu üzrə təhlil, nəticə və fərdi inkişaf planı."],
["Peşəkar müəllimlərlə<br><em>uğura</em> birlikdə!","Dövlət qulluğundan magistraturaya qədər 9 istiqamət."]];
let si=0;const t=document.getElementById('slideTitle'),x=document.getElementById('slideText');
function show(i){si=(i+slides.length)%slides.length;t.innerHTML=slides[si][0];x.textContent=slides[si][1];}
document.querySelector('.arrow.l').onclick=()=>show(si-1);
document.querySelector('.arrow.r').onclick=()=>show(si+1);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduce)setInterval(()=>show(si+1),7000);

document.querySelectorAll('[data-n]').forEach(el=>{
  const n=+el.dataset.n,s=el.dataset.s||'';
  const fmt=v=>Math.round(v).toLocaleString('en-US').replace(/,/g,'.')+s;
  if(reduce){el.textContent=fmt(n);return;}
  new IntersectionObserver((e,o)=>{if(!e[0].isIntersecting)return;o.disconnect();const st=performance.now();
    (function f(now){const p=Math.min((now-st)/1400,1);el.textContent=fmt(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f);})(st);
  }).observe(el);
});

let sec=29*60+45;const tm=document.getElementById('timer');
setInterval(()=>{sec=sec>0?sec-1:29*60+45;const m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');tm.textContent=`00:${m}:${s}`;},1000);

const b=document.querySelector('.burger'),m=document.querySelector('.menu');
b.onclick=()=>{const o=m.classList.toggle('open');b.setAttribute('aria-expanded',o)};
m.querySelectorAll('a').forEach(a=>a.onclick=()=>{m.classList.remove('open');b.setAttribute('aria-expanded',false)});

document.getElementById('newsForm').onsubmit=e=>{e.preventDefault();document.getElementById('newsMsg').textContent='Abunə olduğunuz üçün təşəkkürlər!';e.target.reset();};
