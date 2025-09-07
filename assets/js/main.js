  const API = {
      users: 'https://jsonplaceholder.typicode.com/users',
      posts: 'https://jsonplaceholder.typicode.com/posts',
      comments: (id)=>`https://jsonplaceholder.typicode.com/comments?postId=${id}`
    };
    const store = {
      get(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{ return fallback } },
      set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
    };
    const favKey = 'favUsers';
    const themeKey = 'themeMode';

    function setTheme(mode){
      document.body.classList.toggle('dark', mode==='dark');
      store.set(themeKey, mode);
      toastr.info(`تم تفعيل الوضع ${mode==='dark' ? 'الداكن' : 'الفاتح'}`);
    }

    function showSection(id){
      $('section').removeClass('active');
      $(`#section-${id}`).addClass('active');
      $('nav a').removeClass('active');
      $(`nav a[data-section="${id}"]`).addClass('active');
    }

    function openModal($m){ $m.addClass('show'); }
    function closeModal($m){ $m.removeClass('show'); }

    // ------------------ State ------------------
    let USERS = []; // fetched, then editable locally
    let POSTS = []; // fetched, then add/edit/delete locally
    let EDIT_USER_ID = null;
    let EDIT_POST_ID = null; // null for add

    // ------------------ Init ------------------
    $(async function(){
      // Toastr config
      toastr.options = { positionClass: 'toast-bottom-left', timeOut: 2000 };

      // Theme from storage
      const savedTheme = store.get(themeKey, window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(savedTheme);

      // Router (hash)
      const route = ()=>{
        const id = (location.hash.replace('#','')||'dashboard');
        showSection(id);
      }
      $(window).on('hashchange', route); route();

      // Actions
      $('#toggleTheme').on('click', ()=> setTheme(document.body.classList.contains('dark')? 'light' : 'dark'));
      $('#reload').on('click', ()=>{ loadAll(true); });
      $('#addPost').on('click', ()=>{ EDIT_POST_ID = null; $('#pm_title').text('إضافة Post'); $('#pm_postTitle').val(''); $('#pm_postBody').val(''); openModal($('#postModal')); });
      $('#pm_cancel').on('click', ()=> closeModal($('#postModal')));
      $('#um_cancel').on('click', ()=> closeModal($('#userModal')));

      await loadAll();
    });

    async function loadAll(force=false){
      $('#loader').show();
      try{
        // Fetch in parallel unless cached and not forced
        const [users, posts, comments] = await Promise.all([
          fetch(API.users).then(r=>r.json()),
          fetch(API.posts).then(r=>r.json()),
          fetch(API.comments(1).replace('1','')).then(r=>r.json()).catch(()=>[]) // Not used directly; we only need counts; but this triggers 404. We'll fetch comments differently below.
        ]);
        USERS = users;
        POSTS = posts.slice(0, 50); // واجهة الديمو – نأخذ 50 لتسريع العرض

        // Comments count (الحقيقي 500)
        const commentsAll = await fetch('https://jsonplaceholder.typicode.com/comments').then(r=>r.json());

        // Stats
        $('#statUsers').text(USERS.length);
        $('#statPosts').text(POSTS.length);
        $('#statComments').text(commentsAll.length);

        renderUsersTable();
        renderPosts();
        toastr.success('تم تحميل البيانات.');
      }catch(e){
        console.error(e);
        toastr.error('فشل تحميل البيانات من API');
      }finally{
        $('#loader').fadeOut(200);
      }
    }

    // ------------------ Users (DataTables) ------------------
    let usersDT = null;
    function renderUsersTable(){
      const favs = new Set(store.get(favKey, []));
      const rows = USERS.map(u=>({
        id:u.id,
        fav: favs.has(u.id),
        name:u.name,
        email:u.email,
        company:u.company?.name ?? '-' 
      }));

      // Build tbody HTML for initial render
      const $tbody = $('#usersTable tbody').empty();
      for(const r of rows){
        $tbody.append(`
          <tr data-id="${r.id}">
            <td class="tc"><i class="fa-star star ${r.fav?'fa-solid fav':'fa-regular'}" title="Toggle Favorite"></i></td>
            <td>${r.name}</td>
            <td>${r.email}</td>
            <td>${r.company}</td>
            <td>
              <button class="btn btn-view" title="عرض"><i class="fa-regular fa-eye"></i></button>
              <button class="btn btn-edit" title="تعديل"><i class="fa-regular fa-pen-to-square"></i></button>
              <button class="btn btn-del" title="حذف"><i class="fa-regular fa-trash-can"></i></button>
            </td>
          </tr>`);
      }

      // (Re)Init DataTable
      if(usersDT){ usersDT.destroy(); }
      usersDT = new $.fn.dataTable.Api($('#usersTable').DataTable({
        language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/ar.json' },
        pageLength: 5
      }));

      // Row events
      $('#usersTable').off('click').on('click','.star', function(){
        const $tr = $(this).closest('tr'); const id = Number($tr.data('id'));
        const favs = new Set(store.get(favKey, []));
        if(favs.has(id)){ favs.delete(id); toastr.info('تمت الإزالة من المفضلة'); }
        else { favs.add(id); toastr.success('تمت الإضافة إلى المفضلة'); }
        store.set(favKey, [...favs]);
        $(this).toggleClass('fa-solid fav').toggleClass('fa-regular');
      }).on('click','.btn-view', function(){
        const id = Number($(this).closest('tr').data('id'));
        const u = USERS.find(x=>x.id===id);
        alert(`\nالاسم: ${u.name}\nالإيميل: ${u.email}\nالهاتف: ${u.phone}\nالشركة: ${u.company?.name}`);
      }).on('click','.btn-edit', function(){
        const id = Number($(this).closest('tr').data('id'));
        const u = USERS.find(x=>x.id===id);
        EDIT_USER_ID = id;
        $('#um_name').val(u.name); $('#um_email').val(u.email); $('#um_company').val(u.company?.name || '');
        openModal($('#userModal'));
      }).on('click','.btn-del', function(){
        const id = Number($(this).closest('tr').data('id'));
        USERS = USERS.filter(x=>x.id!==id);
        toastr.warning('تم حذف المستخدم محليًا');
        renderUsersTable();
      });

      // Save in modal
      $('#um_save').off('click').on('click', function(){
        const name=$('#um_name').val().trim();const email=$('#um_email').val().trim();const comp=$('#um_company').val().trim();
        if(!name||!email){ toastr.error('الاسم والإيميل مطلوبان'); return; }
        const u = USERS.find(x=>x.id===EDIT_USER_ID);
        if(u){ u.name=name; u.email=email; u.company = { name: comp||'-' }; }
        toastr.success('تم حفظ التعديل');
        closeModal($('#userModal'));
        renderUsersTable();
      });
    }

    // ------------------ Posts ------------------
    function renderPosts(filter=""){
      const list = $('#postsList').empty();
      const q = filter.toLowerCase();
      const items = POSTS.filter(p=> p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));
      if(items.length===0){ list.append(`<div class="card">لا توجد نتائج.</div>`); return; }
      for(const p of items){
        list.append(`
          <div class="post" data-id="${p.id}">
            <div class="actions" style="justify-content:space-between">
              <span class="badge">ID: ${p.id}</span>
              <div class="actions">
                <button class="btn btn-sm btn-cmts"><i class="fa-regular fa-comments"></i> تعليقات</button>
                <button class="btn btn-sm btn-editp"><i class="fa-regular fa-pen-to-square"></i> تعديل</button>
                <button class="btn btn-sm btn-delp"><i class="fa-regular fa-trash-can"></i> حذف</button>
              </div>
            </div>
            <h4>${escapeHtml(p.title)}</h4>
            <div class="muted">User #${p.userId}</div>
            <p style="margin:8px 0 0">${escapeHtml(p.body)}</p>
          </div>
        `);
      }

      // attach handlers
      $('#postsList .btn-cmts').off('click').on('click', async function(){
        const id = Number($(this).closest('.post').data('id'));
        await loadComments(id);
      });
      $('#postsList .btn-editp').off('click').on('click', function(){
        const id = Number($(this).closest('.post').data('id'));
        const p = POSTS.find(x=>x.id===id);
        EDIT_POST_ID = id; $('#pm_title').text('تعديل Post');
        $('#pm_postTitle').val(p.title); $('#pm_postBody').val(p.body);
        openModal($('#postModal'));
      });
      $('#postsList .btn-delp').off('click').on('click', function(){
        const id = Number($(this).closest('.post').data('id'));
        POSTS = POSTS.filter(x=>x.id!==id);
        toastr.warning('تم حذف الـ Post محليًا');
        renderPosts($('#postSearch').val());
        $('#commentsCard').hide();
      });

      // live search
      $('#postSearch').off('input').on('input', function(){ renderPosts(this.value); });

      // save post (add/edit)
      $('#pm_save').off('click').on('click', function(){
        const title=$('#pm_postTitle').val().trim(); const body=$('#pm_postBody').val().trim();
        if(!title||!body){ toastr.error('العنوان والمحتوى مطلوبان'); return; }
        if(EDIT_POST_ID==null){
          const maxId = POSTS.reduce((m,x)=> Math.max(m, Number(x.id)||0), 0);
          const newPost = { id: maxId+1, userId: 1, title, body };
          POSTS.unshift(newPost);
          toastr.success('تمت إضافة Post محليًا');
        }else{
          const p = POSTS.find(x=>x.id===EDIT_POST_ID);
          if(p){ p.title=title; p.body=body; toastr.success('تم حفظ التعديل'); }
        }
        closeModal($('#postModal'));
        renderPosts($('#postSearch').val());
      });
    }

    async function loadComments(postId){
      $('#commentsCard').show();
      $('#comments').html('... جاري التحميل');
      try{
        const data = await fetch(API.comments(postId)).then(r=>r.json());
        if(!data.length){ $('#comments').html('<div class="muted">لا توجد تعليقات</div>'); return; }
        const html = data.map(c=>`<div class="card" style="margin:8px 0"><strong>${escapeHtml(c.email)}</strong><div class="muted">${escapeHtml(c.name)}</div><p style="margin:6px 0 0">${escapeHtml(c.body)}</p></div>`).join('');
        $('#comments').html(html);
        toastr.info('تم عرض التعليقات');
      }catch(e){
        console.error(e); toastr.error('فشل تحميل التعليقات');
      }
    }

    function escapeHtml(str){
      return String(str).replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]));
    }