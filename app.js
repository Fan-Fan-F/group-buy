// 拼团系统逻辑
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  // 团结构：{ id, productId, leader, members: [], need, expireAt, status: ongoing|success|failed }
  let teams = load("group-teams", []);
  let myTeamIds = load("group-mine", []);
  function load(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
  function save() {
    localStorage.setItem("group-teams", JSON.stringify(teams));
    localStorage.setItem("group-mine", JSON.stringify(myTeamIds));
  }

  /* ---------- Tabs ---------- */
  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
      ["mall", "ongoing", "mine"].forEach(id => $("#tab-" + id).hidden = id !== t.dataset.tab);
      render();
    }));

  /* ---------- 开团 ---------- */
  function createTeam(productId) {
    const p = GROUP_PRODUCTS.find(x => x.id === productId);
    const team = {
      id: "T" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      productId,
      members: [{ name: "我", avatar: "😎", me: true }],
      need: p.need,
      expireAt: Date.now() + p.durationMin * 60000,
      status: "ongoing",
      createdAt: Date.now(),
    };
    teams.unshift(team);
    myTeamIds.unshift(team.id);
    save();
    toast(`开团成功！邀请 ${p.need - 1} 位好友参团即可成团`);
    document.querySelector('[data-tab="mine"]').click();
  }

  /* ---------- 参团 ---------- */
  function joinTeam(teamId, me = true) {
    const team = teams.find(t => t.id === teamId);
    if (!team || team.status !== "ongoing") return;
    if (team.members.length >= team.need) return;
    team.members.push(me
      ? { name: "我", avatar: "😎", me: true }
      : { name: "好友", avatar: FRIENDS[Math.floor(Math.random() * FRIENDS.length)] });
    if (me && !myTeamIds.includes(teamId)) myTeamIds.push(teamId);
    if (team.members.length >= team.need) {
      team.status = "success";
      toast("🎉 成团啦！商家将尽快发货");
    } else {
      toast(`参团成功！还差 ${team.need - team.members.length} 人`);
    }
    save();
    render();
  }

  /* ---------- 倒计时 & 过期 ---------- */
  function tick() {
    let changed = false;
    teams.forEach(t => {
      if (t.status === "ongoing" && Date.now() > t.expireAt) {
        t.status = "failed";
        changed = true;
        if (myTeamIds.includes(t.id)) toast("⏰ 有拼团超时未成团，款项已自动退回");
      }
    });
    if (changed) save();
    renderTimers();
  }
  setInterval(tick, 1000);

  function fmtLeft(expireAt) {
    const ms = Math.max(0, expireAt - Date.now());
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderTimers() {
    document.querySelectorAll("[data-expire]").forEach(el => {
      el.textContent = "⏱ " + fmtLeft(+el.dataset.expire);
    });
  }

  /* ---------- 渲染 ---------- */
  function renderMall() {
    $("#mallList").innerHTML = GROUP_PRODUCTS.map(p => `
      <div class="g-card">
        <div class="g-emoji" style="background:hsl(${p.hue},70%,92%)">${p.emoji}</div>
        <div class="g-main">
          <p class="g-name">${p.name}</p>
          <p class="g-desc">${p.desc}</p>
          <span class="g-need">${p.need} 人成团</span>
          <div class="g-foot">
            <div class="g-price"><b>¥${p.groupPrice}</b><s>¥${p.soloPrice}</s></div>
            <div class="g-btns">
              <button class="btn-solo" data-solo="${p.id}">¥${p.soloPrice} 单买</button>
              <button class="btn-group" data-group="${p.id}">发起拼团</button>
            </div>
          </div>
        </div>
      </div>`).join("");
  }

  function teamCard(t, mine) {
    const p = GROUP_PRODUCTS.find(x => x.id === t.productId);
    const slots = Array.from({ length: t.need }, (_, i) => t.members[i]);
    const statusBadge = t.status === "success" ? `<span class="badge success">已成团</span>`
      : t.status === "failed" ? `<span class="badge failed">已流团</span>`
      : `<span class="badge ongoing">拼团中</span>`;
    return `
    <div class="team-card">
      <div class="team-head">
        <span class="mono">团号 ${t.id}</span>
        ${t.status === "ongoing" ? `<span class="team-timer" data-expire="${t.expireAt}">⏱ ${fmtLeft(t.expireAt)}</span>` : statusBadge}
      </div>
      <p class="team-prod">${p.emoji} ${p.name} <span style="color:var(--accent)">¥${p.groupPrice}</span></p>
      <div class="team-members">
        ${slots.map(m => m
          ? `<div class="member ${m.me ? "leader" : ""}" title="${m.name}">${m.avatar}</div>`
          : `<div class="member empty">?</div>`).join("")}
      </div>
      <div class="team-progress">
        <span>${t.members.length}/${t.need} 人${t.status === "ongoing" ? `，还差 ${t.need - t.members.length} 人` : ""}</span>
        ${t.status === "success" ? `<span style="color:var(--green)">已锁价 ¥${p.groupPrice}（省 ¥${(p.soloPrice - p.groupPrice).toFixed(1)}）</span>` : ""}
        ${t.status === "failed" ? `<span style="color:var(--red)">已自动退款</span>` : ""}
      </div>
      ${t.status === "ongoing" ? `
        <div class="team-actions">
          ${!mine ? `<button class="join-btn" data-join="${t.id}">参团 ¥${p.groupPrice}</button>` : ""}
          <button class="sim-btn" data-sim="${t.id}">🔧 模拟好友参团</button>
        </div>` : ""}
    </div>`;
  }

  function render() {
    renderMall();
    const ongoing = teams.filter(t => t.status === "ongoing");
    $("#ongoingCount").textContent = ongoing.length ? ongoing.length : "";
    $("#ongoingList").innerHTML = ongoing.length
      ? ongoing.map(t => teamCard(t, t.members.some(m => m.me))).join("")
      : `<p class="empty">暂无进行中的团，去开第一个吧</p>`;
    const mine = teams.filter(t => myTeamIds.includes(t.id));
    $("#mineList").innerHTML = mine.length
      ? mine.map(t => teamCard(t, true)).join("")
      : `<p class="empty">你还没有拼团记录</p>`;
  }

  /* ---------- 事件 ---------- */
  $("#mallList").addEventListener("click", (e) => {
    const g = e.target.closest("[data-group]");
    const s = e.target.closest("[data-solo]");
    if (g) createTeam(g.dataset.group);
    if (s) toast("已按单买价下单（演示）");
  });

  document.body.addEventListener("click", (e) => {
    const j = e.target.closest("[data-join]");
    const sim = e.target.closest("[data-sim]");
    if (j) joinTeam(j.dataset.join, true);
    if (sim) joinTeam(sim.dataset.sim, false);
  });

  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    setTimeout(() => (t.hidden = true), 2400);
  }

  // 预置一个别人发起的团（即将满员）
  if (!teams.length) {
    const demo = {
      id: "TDEMO88", productId: "g1",
      members: [{ name: "团长小橘", avatar: "👧" }, { name: "好友", avatar: "🧑" }],
      need: 3, expireAt: Date.now() + 18 * 60000, status: "ongoing", createdAt: Date.now(),
    };
    teams.push(demo);
    save();
  }

  render();
})();
