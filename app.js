const SUPABASE_URL = "https://nwhzklxxssfksidvvtml.supabase.co";
const SUPABASE_KEY = "sb_publishable_YNuqLv6AGNOVPBkMD6lx8Q_qHBE65CG";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
const starterClients=[{name:"Atelier Urban",industry:"Fashion & lifestyle",status:"Activă"},{name:"Nordic Coffee",industry:"Cafea & horeca",status:"Activă"}];
let clients=JSON.parse(localStorage.getItem("tam_clients")||"null")||starterClients;
const $=s=>document.querySelector(s);
function save(){localStorage.setItem("tam_clients",JSON.stringify(clients));renderClients()}
function renderClients(){
  $("#client-count").textContent=clients.length;
  $("#overview-clients").innerHTML=clients.slice(0,4).map(c=>`<article class="client-card"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.industry)}</p><span class="tag">${escapeHtml(c.status)}</span></article>`).join("");
  
$("#client-list").innerHTML = clients.map(c => `
  <div class="client-row">
    <div class="client-info">
      <div class="initial">${escapeHtml(c.name.slice(0,1).toUpperCase())}</div>
      <div>
        <h3>${escapeHtml(c.name)}</h3>
        <p>${escapeHtml(c.industry)}</p>
      </div>
    </div>
    <span class="tag">${escapeHtml(c.status)}</span>
    <button class="primary connect-tiktok" data-company-id="${c.id}">
      Conectează TikTok
    </button>
  </div>
`).join("");

  $("#business").innerHTML=clients.map((c,i)=>`<option value="${i}">${escapeHtml(c.name)}</option>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showPage(id){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
const titles={overview:"Prezentare generală",clients:"Companii",content:"Idei de conținut",posts:"Postările mele",calendar:"Calendar"};
 $("#page-title").textContent=titles[id]||"TikTok AI Manager";
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelector('[data-page="posts"]').addEventListener("click", loadPosts);
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.goto)));

async function addClient() {
  const name = prompt("Numele companiei:");
  if (!name || !name.trim()) return;

  const industry = prompt(
    "Domeniul companiei (ex.: restaurant, beauty, servicii):"
  ) || "Domeniu nespecificat";

  const { data, error } = await supabaseClient
    .from("companies")
    .insert({
      name: name.trim(),
      industry: industry.trim()
    })
    .select()
    .single();

  if (error) {
    alert("Eroare la salvarea companiei: " + error.message);
    return;
  }

  clients.push({
    name: data.name,
    industry: data.industry,
    status: "Activă"
  });

  save();
  await loadCalendar();
  showPage("clients");

}
$("#add-client").addEventListener("click",addClient);

$("#generate").addEventListener("click", async () => {
  const client = clients[Number($("#business").value)];
  const topic = $("#topic").value.trim() || "prezentarea afacerii";

  if (!client) {
    alert("Adaugă mai întâi o companie.");
    return;
  }

  const generated = $("#generated");
  generated.classList.remove("hidden");
  generated.textContent = "AI-ul pregătește postarea...";

  const { data: aiData, error: aiError } =
    await supabaseClient.functions.invoke("swift-service", {
      body: { topic, company: client.name }
    });

  if (aiError) {
  let details = aiError.message;

  try {
    const body = await aiError.context.json();
    details += " — " + (body.error || JSON.stringify(body));
  } catch (e) {}

  generated.textContent = "";
  alert("Eroare la generatorul AI: " + details);
  console.error(aiError);
  return;
}

  if (!aiData?.result) {
    generated.textContent = "";
    alert("Generatorul AI nu a returnat un rezultat: " + (aiData?.error || "Răspuns gol"));
    return;
  }

  const text = aiData.result;

  function extractSection(label, nextLabels) {
    const upper = text.toUpperCase();
    const start = upper.indexOf(label);

    if (start === -1) return "";

    const contentStart = start + label.length;
    let end = text.length;

    for (const nextLabel of nextLabels) {
      const position = upper.indexOf(nextLabel, contentStart);
      if (position !== -1 && position < end) end = position;
    }

    return text.slice(contentStart, end).trim().replace(/^[:\s*-]+/, "");
  }

  const title = extractSection("TITLU", ["SCENARIU VIDEO", "DESCRIERE", "HASHTAGURI"])
    || "Postare TikTok pentru " + client.name;

  const script = extractSection("SCENARIU VIDEO", ["DESCRIERE", "HASHTAGURI"]);
  const caption = extractSection("DESCRIERE", ["HASHTAGURI"]);
  const hashtags = extractSection("HASHTAGURI", []);

  const { error: saveError } = await supabaseClient
    .from("content_posts")
    .insert([{
      company_id: client.id,
      title,
      script,
      caption,
      hashtags,
      status: "draft"
    }]);

  if (saveError) {
    generated.textContent = "";
    alert("Nu am putut salva postarea: " + saveError.message);
    console.error(saveError);
    return;
  }

  generated.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <b>Scenariu video:</b><br>${escapeHtml(script)}<br><br>
    <b>Descriere:</b><br>${escapeHtml(caption)}<br>
    <b>Hashtaguri:</b><br>${escapeHtml(hashtags)}
    <br><br><small>Postarea AI a fost salvată în Supabase.</small>
  `;

  alert("Postarea generată de AI a fost salvată!");
});

async function  loadCompanies() {
  const { data, error } = await supabaseClient
    .from("company_members")
    .select(`
      companies (
        id,
        name,
        industry
      )
    `)
.eq("user_id", (await supabaseClient.auth.getUser()).data.user.id);

  if (error) {
    console.error("Eroare la încărcarea companiilor:", error);
    alert("Nu pot încărca firmele: " + error.message);
    return;
  }

  clients = data
    .filter(member => member.companies)
    .map(member => ({
      id: member.companies.id,
      name: member.companies.name,
      industry: member.companies.industry || "Domeniu nespecificat",
      status: "Activă"
    }));

      save();
      await loadCalendar();
}

async function loadCalendar() {
  const calendar = document.querySelector("#calendarPosts");

  if (!calendar) return;

  if (!clients.length) {
    calendar.innerHTML = "<p>Nu există companii asociate.</p>";
    return;
  }

  calendar.innerHTML = "<p>Se încarcă postările programate...</p>";

  const companyIds = clients.map(company => company.id);
  console.log("COMPANII ȘI ID-URI:", clients);

  const { data, error } = await supabaseClient
    .from("content_posts")
    .select("id, company_id, title, status, scheduled_at")
    .in("company_id", companyIds)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true });

  if (error) {
    calendar.innerHTML = "<p>Eroare: " + escapeHtml(error.message) + "</p>";
    return;
  }

  if (!data || data.length === 0) {
    calendar.innerHTML = "<p>Nu ai încă postări programate.</p>";
    return;
  }

  calendar.innerHTML = data.map(post => {
    const company = clients.find(c => c.id === post.company_id);
    const date = new Date(post.scheduled_at);

    return `
      <div class="day">
        <b>${date.toLocaleDateString("ro-RO", {
          weekday: "long",
          day: "2-digit",
          month: "long"
        })}</b>
        <span>${date.toLocaleTimeString("ro-RO", {
          hour: "2-digit",
          minute: "2-digit"
        })}</span>
        <p>${escapeHtml(post.title || "Postare fără titlu")}</p>
        <em>${escapeHtml(post.status || "Ciornă")}</em>
        <small>${escapeHtml(company?.name || "")}</small>
      </div>
    `;
  }).join("");
}
async function loadPosts() {
  const list = document.querySelector("#posts-list");console.log("POSTS LIST:", list);

  if (!clients.length) {
    list.innerHTML = "<p>Nu există companii asociate contului tău.</p>";
    return;
  }

  list.innerHTML = "<p>Se încarcă postările...</p>";

  const companyIds = clients.map(company => company.id);
  console.log("COMPANII DIN POSTĂRI:", clients);
console.log("ID-URI:", companyIds);

  const { data, error } = await supabaseClient
    .from("content_posts")
    .select("id, company_id, title, script, caption, hashtags, status, created_at")
    .in("company_id", companyIds)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "<p>Eroare la încărcarea postărilor: " +
      escapeHtml(error.message) + "</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>Nu ai încă postări salvate.</p>";
    return;
  }

  list.innerHTML = data.map(post => {
    const company = clients.find(c => c.id === post.company_id);

    return `
      <div class="panel">
        <h3>${escapeHtml(post.title || "Postare fără titlu")}</h3>
        <button class="edit-post" data-id="${post.id}">Editează</button>
        <button class="schedule-post" data-id="${post.id}">Programează</button>
        <p><b>Companie:</b> ${escapeHtml(company?.name || "")}</p>
        <p><b>Scenariu:</b> ${escapeHtml(post.script || "")}</p>
        <p><b>Descriere:</b> ${escapeHtml(post.caption || "")}</p>
        <p><b>Hashtaguri:</b> ${escapeHtml(post.hashtags || "")}</p>
        <p><b>Status:</b> ${escapeHtml(post.status || "")}</p>
        <button class="delete-post" data-id="${post.id}">Șterge</button>
      </div>
    `;
  }).join("");
  
  
  list.querySelectorAll(".edit-post").forEach(button => {
  button.addEventListener("click", async () => {
    const postId = button.dataset.id;

    const { data: post, error } = await supabaseClient
      .from("content_posts")
      .select("title, script, caption, hashtags")
      .eq("id", postId)
      .single();

    if (error) {
      alert("Eroare la încărcarea postării: " + error.message);
      return;
    }

    const title = prompt("Titlul postării:", post.title || "");
    if (title === null) return;

    const script = prompt("Scenariul:", post.script || "");
    if (script === null) return;

    const caption = prompt("Descrierea:", post.caption || "");
    if (caption === null) return;

    const hashtags = prompt("Hashtagurile:", post.hashtags || "");
    if (hashtags === null) return;

    const { error: updateError } = await supabaseClient
      .from("content_posts")
      .update({ title, script, caption, hashtags })
      .eq("id", postId);

    if (updateError) {
      alert("Eroare la salvare: " + updateError.message);
      return;
    }

    alert("Postarea a fost modificată!");
    await loadPosts();
  });
});
  list.querySelectorAll(".delete-post").forEach(button => {
  button.addEventListener("click", async () => {
    if (!confirm("Sigur vrei să ștergi această postare?")) return;

    const { error } = await supabaseClient
      .from("content_posts")
      .delete()
      .eq("id", button.dataset.id);

    if (error) {
      alert("Eroare la ștergere: " + error.message);
      return;
    }

    alert("Postarea a fost ștearsă!");
    loadPosts();
  });
});
list.querySelectorAll(".schedule-post").forEach(button => {
  button.addEventListener("click", async () => {
    const date = prompt("Introdu data și ora (exemplu: 2026-11-10T18:30)");

    if (!date) return;

    const scheduledAt = new Date(date);

    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      alert("Introdu o dată și o oră valide, în viitor.");
      return;
    }

    const { error } = await supabaseClient
      .from("content_posts")
      .update({
        scheduled_at: scheduledAt.toISOString(),
        status: "scheduled"
      })
      .eq("id", button.dataset.id);

    if (error) {
      alert("Eroare la programare: " + error.message);
      return;
    }

    alert("Postarea a fost programată!");
    await loadPosts();
    await loadCalendar();
  });
});
}

loadCompanies();
renderClients();
const loginForm = document.querySelector("#login-form");
const loginScreen = document.querySelector("#login-screen");
console.log("TEST LOGIN:", loginScreen);
const loginMessage = document.querySelector("#login-message");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;

  loginMessage.textContent = "Se verifică datele...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginMessage.textContent = "Eroare: " + error.message;
    return;
  }

  await checkAdminRole();
});

async function checkLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    loginScreen.style.display = "flex";
  }
}
checkLogin();
async function checkAdminRole() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError || !user) {
    loginScreen.style.display = "flex";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Eroare profil:", error);
    alert("Nu pot verifica profilul: " + error.message);
    return;
  }

  if (!profile || !["admin", "client"].includes(profile.role)) {
    alert("Contul nu are rol de administrator.");
    await supabaseClient.auth.signOut();
    loginScreen.style.display = "flex";
    return;
  }

 loginScreen.style.display = "none";
  }
checkAdminRole();

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".connect-tiktok");

  if (!button) return;

  const companyId = button.dataset.companyId;

  button.disabled = true;
  button.textContent = "Se conectează...";

  try {
    const { data, error } = await supabaseClient.functions.invoke(
      "tiktok-auth-start",
      {
        body: {
          company_id: companyId
        }
      }
    );

    if (error) throw error;

    if (!data?.authorization_url) {
      throw new Error("Nu am primit adresa de autorizare TikTok.");
    }

    window.location.href = data.authorization_url;

  } catch (error) {
    console.error("Eroare conectare TikTok:", error);
    alert("Nu s-a putut porni conectarea TikTok: " + error.message);

    button.disabled = false;
    button.textContent = "Conectează TikTok";
  }
});


