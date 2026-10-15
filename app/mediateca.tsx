'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {loadLibrary,saveLibrary,mediaUrl,signOut} from '../lib/api';
import {
  Folder,Headphones,Video,Plus,Search,ArrowUpRight,Upload,LayoutGrid,
  MessageSquare,ShieldCheck,X,ChevronRight,ChevronLeft,Play,Trash2,
  BookOpen,LogOut
} from 'lucide-react';

type Category={
  id:string;
  name:string;
  description:string;
  parent_id:string|null;
};

type Media={
  id:string;
  title:string;
  description:string;
  category:string;
  kind:string;
  size:number;
  author:string;
  owner:string;
  created:string;
  path:string;
  src?:string;
};

type Data={
  user:{name:string;email:string;id:string;owner:boolean;teacher:boolean;twoFactorEnabled?:boolean};
  categories:Category[];
  media:Media[];
  comments:{id:string;media:string;body:string;author:string;created:string}[];
  teachers:{email:string}[];
};

export default function Mediateca(){
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState('');
  const [tab,setTab]=useState('all');
  const [category,setCategory]=useState('');
  const [q,setQ]=useState('');
  const [modal,setModal]=useState('');
  const [selected,setSelected]=useState<Media|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  async function load(){
    try{
      const d=await loadLibrary();
      setData(d as Data);
      setError('');
    }catch(e){
      setError(e instanceof Error?e.message:'No se pudo conectar');
    }
  }

  useEffect(()=>{void load()},[]);

  async function mutate(body:FormData|object){
    setBusy(true);
    setError('');
    try{
      await saveLibrary(body);
      await load();
      setNotice('Cambios guardados');
      return true;
    }catch(e){
      setError(e && typeof e==='object' && 'message' in e?String(e.message):'No se pudo guardar');
      return false;
    }finally{
      setBusy(false);
    }
  }

  async function openMedia(m:Media){
    try{
      setSelected({...m,src:await mediaUrl(m.id)});
    }catch(e){
      setError(e instanceof Error?e.message:'No se pudo abrir el archivo');
    }
  }

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    let body:FormData|object=f;

    if(modal==='category'){
      body={
        action:'category',
        name:f.get('name'),
        description:f.get('description'),
        parent:f.get('parent')
      };
    }
    if(modal==='teachers'){
      body={action:'teacher',email:f.get('email')};
    }

    if(await mutate(body)){
      if(modal!=='teachers')setModal('');
      else (e.target as HTMLFormElement).reset();
    }
  }

  const admin=!!data&&(data.user.owner||data.user.teacher);
  const currentCat=data?.categories.find(c=>c.id===category);

  const childrenOf=(parent:string|null)=>data?.categories.filter(c=>(c.parent_id||null)===parent)||[];

  function categoryPath(id:string){
    if(!data)return '';
    const names:string[]=[];
    const seen=new Set<string>();
    let current=data.categories.find(c=>c.id===id);
    while(current&&!seen.has(current.id)){
      seen.add(current.id);
      names.unshift(current.name);
      const parentId=current.parent_id;
      current=parentId?data.categories.find(c=>c.id===parentId):undefined;
    }
    return names.join(' / ');
  }

  function descendantIds(id:string){
    const found=new Set<string>([id]);
    let changed=true;
    while(changed){
      changed=false;
      for(const c of data?.categories||[]){
        if(c.parent_id&&found.has(c.parent_id)&&!found.has(c.id)){
          found.add(c.id);
          changed=true;
        }
      }
    }
    return found;
  }

  const folderChildren=childrenOf(category||null);

  const breadcrumbs=useMemo(()=>{
    if(!data||!category)return [] as Category[];
    const out:Category[]=[];
    const seen=new Set<string>();
    let current=data.categories.find(c=>c.id===category);
    while(current&&!seen.has(current.id)){
      seen.add(current.id);
      out.unshift(current);
      const parentId=current.parent_id;
      current=parentId?data.categories.find(c=>c.id===parentId):undefined;
    }
    return out;
  },[data,category]);

  const leafCategories=(data?.categories||[]).filter(c=>!data?.categories.some(x=>x.parent_id===c.id));
  const selectedScope=category?descendantIds(category):null;

  const files=(data?.media||[]).filter(m=>
    (!selectedScope||selectedScope.has(m.category))&&
    (!['audio','video'].includes(tab)||m.kind===tab)&&
    (tab!=='mine'||m.owner===data?.user.id)&&
    (tab!=='feedback'||data?.comments.some(c=>c.media===m.id))&&
    (m.title+' '+m.author+' '+categoryPath(m.category)).toLowerCase().includes(q.toLowerCase())
  );

  const defaultUploadCategory=category&&leafCategories.some(c=>c.id===category)?category:'';

  return <div className="shell">
    <aside>
      <a className="brand" href="/">
        <img src="/logo.png" alt="Logo CSLB"/>
        <span>CSLB<span className="brand-sub">MEDIATECA</span></span>
      </a>

      <div className="nav-label">ESPACIO DE APRENDIZAJE</div>
      <nav>
        {[
          ['all',admin?'Biblioteca':'Mis trabajos',LayoutGrid],
          ['audio','Audios',Headphones],
          ['video','Videos',Video],
          ['mine','Mis archivos',Folder],
          ['feedback','Retroalimentación',MessageSquare]
        ].map(([id,label,Icon]:any)=>
          <button key={id} className={tab===id?'nav active':'nav'} onClick={()=>{setTab(id);setCategory('')}}>
            <Icon size={19}/>{label}{id==='all'&&<small>{data?.media.length||0}</small>}
          </button>
        )}
      </nav>

      <div className="side-bottom">
        <div className="side-note">
          <BookOpen size={22}/>
          <strong>{admin?'Acompaña los aprendizajes.':'Tu espacio es privado.'}</strong>
          <p>{admin
            ?'Puedes revisar trabajos, organizar carpetas y dejar retroalimentación.'
            :'Solo tú y tus profesores pueden ver los archivos que subes.'}</p>
        </div>

        {data?.user.owner&&
          <button className="nav" onClick={()=>setModal('teachers')}>
            <ShieldCheck size={19}/>Gestionar profesores
          </button>
        }

        <div className="profile">
          <span className="avatar">{data?.user.name?.[0]?.toUpperCase()||'C'}</span>
          <div>
            <strong>{data?.user.name||'Comunidad CSLB'}</strong>
            <small>{data?.user.owner?'Administrador principal':data?.user.teacher?'Profesor · Administrador':'Estudiante'}</small>
          </div>
          <a href="#" onClick={e=>{e.preventDefault();void signOut()}} aria-label="Cerrar sesión">
            <LogOut size={16}/>
          </a>
        </div>
      </div>
    </aside>

    <main>
      <header>
        <span>Mi colegio <ChevronRight size={14}/> <b>Mediateca</b></span>
        <span className="community"><i/> {admin?'Panel docente':'Tus archivos son privados'}</span>
      </header>

      <div className="content">
        <section className="hero">
          <div>
            <span className="eyebrow">CREAR · COMPARTIR · APRENDER</span>
            <h1>{admin?'Organiza, escucha y acompaña.':'Tu voz. Tus proyectos.'}</h1>
            <p>{admin
              ?'Crea carpetas y subcarpetas por temática o curso, revisa los trabajos y entrega retroalimentación.'
              :'Sube tus audios y videos. Solo tú y tus profesores podrán verlos y escucharlos.'}</p>
            <button className="primary" onClick={()=>setModal('upload')} disabled={!data||!leafCategories.length}>
              <Plus size={18}/> Subir archivo
            </button>
          </div>

          <div className="hero-art" aria-hidden="true">
            <span className="orbit"/>
            <div className="audio-tile">
              <Headphones size={29}/>
              <div className="wave">{[15,28,39,22,46,32,19,35,24,14].map((h,i)=><i key={i} style={{height:h}}/>)}</div>
              <span>Tu voz, tus ideas</span>
            </div>
            <div className="video-tile"><Play size={35} fill="currentColor"/></div>
            <span className="spark">✳</span>
            <span className="art-label">HECHO POR NOSOTROS</span>
          </div>
        </section>

        {error&&<div className="alert" role="alert">
          {error} <button onClick={()=>void load()}>Reintentar</button>
        </div>}

        {notice&&<div role="status" className="notice">
          {notice}<button onClick={()=>setNotice('')} aria-label="Cerrar aviso"><X size={14}/></button>
        </div>}

        <section className="section">
          <div className="section-title">
            <div>
              <h2>
                {currentCat?.name||'Carpetas'}
                <span>{folderChildren.length}</span>
              </h2>
              <p>{currentCat?.description||'Navega por temática, proyecto o curso.'}</p>
            </div>

            {admin&&<button className="text-button" onClick={()=>setModal('category')}>
              <Plus size={17}/> {category?'Nueva subcarpeta':'Nueva carpeta'}
            </button>}
          </div>

          <div className="filters" style={{marginBottom:16}}>
            <button onClick={()=>setCategory('')} className={!category?'chosen':''}>Inicio</button>
            {breadcrumbs.map((c,i)=>
              <button key={c.id} className={i===breadcrumbs.length-1?'chosen':''} onClick={()=>setCategory(c.id)}>
                <ChevronRight size={13}/>{c.name}
              </button>
            )}
          </div>

          {category&&<button className="secondary" style={{marginBottom:14}} onClick={()=>{
            const parent=currentCat?.parent_id||'';
            setCategory(parent);
          }}>
            <ChevronLeft size={15}/> Volver
          </button>}

          <div className="folders">
            {folderChildren.map((c,i)=>{
              const scope=descendantIds(c.id);
              const count=(data?.media||[]).filter(m=>scope.has(m.category)).length;
              const subCount=childrenOf(c.id).length;
              return <button key={c.id} className={'folder tone'+i%4} onClick={()=>setCategory(c.id)}>
                <div><Folder size={30} fill="currentColor" strokeWidth={1.1}/><ArrowUpRight size={18}/></div>
                <h3>{c.name}</h3>
                <p>{c.description||'Explora esta carpeta'}</p>
                <small>{subCount?`${subCount} subcarpetas · `:''}{count} archivos</small>
              </button>;
            })}
          </div>

          {data&&!folderChildren.length&&!currentCat&&
            <div className="first-category">
              <Folder size={30}/>
              <div>
                <strong>Primero crea la estructura de carpetas</strong>
                <p>{admin
                  ?'Ejemplo: Podcast → 7°A y 7°B. Los alumnos no pueden crear carpetas.'
                  :'Tu profesor creará las carpetas y cursos disponibles.'}</p>
              </div>
              {admin&&<button className="secondary" onClick={()=>setModal('category')}>Crear carpeta</button>}
            </div>
          }

          {currentCat&&!folderChildren.length&&
            <div className="first-category">
              <Folder size={30}/>
              <div>
                <strong>Carpeta final</strong>
                <p>{admin
                  ?'Puedes crear otra subcarpeta o permitir que los alumnos suban aquí.'
                  :'Puedes subir tu audio o video en esta carpeta.'}</p>
              </div>
              {admin&&<button className="secondary" onClick={()=>setModal('category')}>Crear subcarpeta</button>}
            </div>
          }
        </section>

        <section className="section">
          <div className="section-title">
            <div>
              <h2>
                {currentCat?.name||({mine:'Mis archivos',feedback:'Con retroalimentación',audio:'Audios',video:'Videos'} as Record<string,string>)[tab]||(admin?'Todos los archivos':'Mis trabajos')}
                <span>{files.length}</span>
              </h2>
              <p>{admin?'Los profesores pueden ver todos los trabajos.':'Aquí solo aparecen archivos que tú subiste.'}</p>
            </div>
            <label className="search">
              <Search size={17}/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar archivo…" aria-label="Buscar archivos"/>
            </label>
          </div>

          <div className="filters">
            {[['all','Todos'],['audio','Audios'],['video','Videos']].map(([id,label])=>
              <button key={id} className={tab===id?'chosen':''} onClick={()=>setTab(id)}>
                {id==='audio'?<Headphones size={15}/>:id==='video'?<Video size={15}/>:<LayoutGrid size={15}/>} {label}
              </button>
            )}
            <span>Más recientes primero</span>
          </div>

          {!data&&!error?
            <div className="empty">Cargando tu mediateca…</div>
          :files.length?
            <div className="file-grid">
              {files.map(m=>
                <button className="file-card" key={m.id} onClick={()=>void openMedia(m)}>
                  <div className={'file-cover '+m.kind}>
                    {m.kind==='audio'?<Headphones size={40}/>:<Video size={40}/>}
                    <span>{m.kind==='audio'?'AUDIO':'VIDEO'}</span>
                    <div className="play"><Play size={17} fill="currentColor"/></div>
                  </div>
                  <div className="file-info">
                    <small>{categoryPath(m.category)}</small>
                    <h3>{m.title}</h3>
                    <p>{admin?m.author:'Subido por ti'}</p>
                    <div>
                      <span>{new Date(m.created).toLocaleDateString('es-CL')} · {(m.size/1048576).toFixed(1)} MB</span>
                      <span><MessageSquare size={13}/> {data?.comments.filter(c=>c.media===m.id).length}</span>
                    </div>
                  </div>
                </button>
              )}
            </div>
          :
            <div className="empty">
              <div className="empty-icon">{q?<Search size={28}/>:<Upload size={28}/>}</div>
              <h3>{q?'No encontramos ese archivo':'No hay archivos aquí todavía'}</h3>
              <p>{q
                ?'Prueba con otro título.'
                :admin
                  ?'Entra a otra carpeta o espera a que los alumnos suban sus trabajos.'
                  :'Sube tu primer audio o video en una carpeta creada por tu profesor.'}</p>
              {!q&&leafCategories.length>0&&
                <button className="secondary" disabled={!data} onClick={()=>setModal('upload')}>
                  <Plus size={16}/> Subir archivo
                </button>}
            </div>
          }
        </section>

        <footer>
          <span>CSLB <b>Mediateca</b></span>
          <span>Un espacio para aprender juntos.</span>
        </footer>
      </div>
    </main>

    {modal&&
      <div className="overlay" onClick={()=>!busy&&setModal('')}>
        <section
          role="dialog"
          aria-modal="true"
          aria-label={modal==='upload'?'Subir archivo':modal==='category'?'Nueva carpeta':'Gestionar profesores'}
          className="modal"
          onClick={e=>e.stopPropagation()}
        >
          <button className="close" aria-label="Cerrar" onClick={()=>setModal('')} disabled={busy}><X/></button>
          <span className="eyebrow">COMUNIDAD CSLB</span>
          <h2>{modal==='upload'?'Sube tu trabajo':modal==='category'?(category?'Nueva subcarpeta':'Nueva carpeta'):'Profesores administradores'}</h2>

          <p>{modal==='upload'
            ?'Los demás alumnos no podrán ver este archivo. Solo tú y tus profesores.'
            :modal==='category'
              ?'Solo profesores y administradores pueden crear la estructura de carpetas.'
              :'Al autorizar un profesor, su sesión se cerrará y en el próximo ingreso deberá activar Google Authenticator.'}</p>

          {error&&<p role="alert" className="alert">{error}</p>}

          <form onSubmit={submit}>
            {modal==='upload'?<>
              <label className="drop">
                <Upload size={28}/>
                <strong>Selecciona tu audio o video</strong>
                <span>MP3, WAV, M4A, OGG, MP4 o WebM · Máximo 200 MB</span>
                <input required type="file" name="file" accept="audio/*,video/mp4,video/webm,video/ogg,video/quicktime"/>
              </label>

              <label>
                Título
                <input name="title" required maxLength={120} placeholder="¿Cómo se llama tu proyecto?"/>
              </label>

              <label>
                Carpeta
                <select required name="category" defaultValue={defaultUploadCategory}>
                  <option value="">Selecciona una carpeta final</option>
                  {leafCategories.map(c=><option key={c.id} value={c.id}>{categoryPath(c.id)}</option>)}
                </select>
              </label>

              {!leafCategories.length&&<p>Primero un profesor debe crear una carpeta final.</p>}

              <label>
                Descripción (opcional)
                <textarea name="description" maxLength={2000} placeholder="Cuéntanos un poco sobre tu trabajo…"/>
              </label>
            </>:modal==='category'?<>
              <label>
                Nombre
                <input name="name" required maxLength={60} placeholder={category?'Por ejemplo: 7°A':'Por ejemplo: Podcast'}/>
              </label>

              <label>
                Carpeta superior
                <select name="parent" defaultValue={category}>
                  <option value="">Raíz de la mediateca</option>
                  {(data?.categories||[]).map(c=><option key={c.id} value={c.id}>{categoryPath(c.id)}</option>)}
                </select>
              </label>

              <label>
                Descripción
                <textarea name="description" maxLength={200} placeholder="¿Qué se guardará en esta carpeta?"/>
              </label>
            </>:<>
              <label>
                Correo del profesor
                <input type="email" name="email" required placeholder="profesor@colegio.cl"/>
              </label>
              <div className="teacher-list">
                {data?.teachers.map(t=>
                  <div key={t.email}>
                    {t.email}
                    <button type="button" aria-label={'Quitar rol a '+t.email} disabled={busy}
                      onClick={()=>void mutate({action:'teacher',email:t.email,remove:true})}>
                      <X size={16}/>
                    </button>
                  </div>
                )}
              </div>
            </>}

            <button disabled={busy||(modal==='upload'&&!leafCategories.length)} className="primary full">
              {busy?'Guardando…':modal==='upload'?'Subir archivo':modal==='category'?'Crear carpeta':'Autorizar profesor'}
            </button>
          </form>
        </section>
      </div>
    }

    {selected&&
      <div className="overlay" onClick={()=>setSelected(null)}>
        <section className="modal viewer" role="dialog" aria-modal="true" aria-label={selected.title} onClick={e=>e.stopPropagation()}>
          <button className="close" aria-label="Cerrar" onClick={()=>setSelected(null)}><X/></button>
          <span className="eyebrow">{categoryPath(selected.category)}</span>
          <h2>{selected.title}</h2>
          <p>{admin?selected.author:'Tu trabajo'}</p>

          {selected.kind==='audio'
            ?<audio controls preload="metadata" src={selected.src}/>
            :<video controls preload="metadata" playsInline src={selected.src}/>
          }

          <p className="description">{selected.description}</p>

          <h3><MessageSquare size={18}/> Retroalimentación del profesor</h3>
          {data?.comments.filter(c=>c.media===selected.id).map(c=>
            <article className="comment" key={c.id}>
              <strong>{c.author}</strong>
              <small>{new Date(c.created).toLocaleDateString('es-CL')}</small>
              <p>{c.body}</p>
            </article>
          )}

          {!data?.comments.some(c=>c.media===selected.id)&&<p>Aún no hay comentarios de retroalimentación.</p>}
          {error&&<p className="alert" role="alert">{error}</p>}

          {admin&&
            <form onSubmit={async e=>{
              e.preventDefault();
              const form=e.currentTarget;
              if(await mutate({action:'comment',media:selected.id,body:new FormData(form).get('body')}))form.reset();
            }}>
              <label>
                Tu retroalimentación
                <textarea required name="body" maxLength={3000} placeholder="Destaca los logros y comparte sugerencias…"/>
              </label>
              <button disabled={busy} className="primary">Publicar comentario</button>
            </form>
          }

          {(admin||selected.owner===data?.user.id)&&
            <button className="delete" disabled={busy} onClick={async()=>{
              if(confirm('¿Eliminar este archivo y su retroalimentación?')){
                if(await mutate({action:'delete',id:selected.id}))setSelected(null);
              }
            }}>
              <Trash2 size={16}/> Eliminar archivo
            </button>
          }
        </section>
      </div>
    }
  </div>;
}
