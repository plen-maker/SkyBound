import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { THEME as C } from '../theme';

// Régi (armeabi-v7a) eszközön Android API < 26 — csökkentett WebView quality
const IS_LOW_END = Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 26;

const NOTE_KEY = '@xdeck_note_v1';

const CANVAS_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08090e;overflow:hidden;width:100vw;height:100vh;display:flex;flex-direction:column}
canvas{display:block;touch-action:none;flex:1;width:100%}
#ctrl{display:flex;gap:8px;padding:10px 12px;background:#0e1018;border-top:1px solid #1e2535;align-items:center;flex-shrink:0}
button{padding:7px 14px;border:1px solid #1e2535;border-radius:8px;background:#0e1018;color:#d4dff0;font-size:13px;font-family:-apple-system,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
#recBtn{background:rgba(94,200,255,.1);border-color:rgba(94,200,255,.3);color:#5ec8ff;font-weight:600}
#recBtn:disabled{opacity:.4}
#status{flex:1;font-size:11px;color:#4a6080;text-align:right;font-family:-apple-system,sans-serif;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sz{width:30px;height:30px;border-radius:6px;border:1px solid #1e2535;background:#0e1018;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#d4dff0;font-size:11px;font-weight:600;font-family:-apple-system,sans-serif;-webkit-tap-highlight-color:transparent}
.sz.on{border-color:#5ec8ff;background:rgba(94,200,255,.1);color:#5ec8ff}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="ctrl">
  <button onclick="clr()">🗑</button>
  <span class="sz on" id="s1" onclick="pen(2,'s1')">S</span>
  <span class="sz" id="s2" onclick="pen(4,'s2')">M</span>
  <span class="sz" id="s3" onclick="pen(7,'s3')">L</span>
  <button id="recBtn" onclick="doOcr()">✦ Szöveg</button>
  <span id="status">írj a tollal…</span>
</div>
<script>
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let draw=false,pw=2,tess=null,hasStrokes=false;

function init(){
  cv.width=window.innerWidth;
  cv.height=cv.parentElement.clientHeight-document.getElementById('ctrl').offsetHeight;
  ctx.fillStyle='#08090e';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#c8d8f0';ctx.lineWidth=pw;
}
window.addEventListener('resize',init);
setTimeout(init,50);

function pt(e){const r=cv.getBoundingClientRect(),s=e.touches?e.touches[0]:e;return{x:s.clientX-r.left,y:s.clientY-r.top};}
cv.addEventListener('pointerdown',e=>{e.preventDefault();draw=true;hasStrokes=true;const p=pt(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineWidth=pw;});
cv.addEventListener('pointermove',e=>{if(!draw)return;e.preventDefault();const p=pt(e);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);});
cv.addEventListener('pointerup',()=>{draw=false;ctx.beginPath();});
cv.addEventListener('pointerleave',()=>{draw=false;});

function clr(){ctx.fillStyle='#08090e';ctx.fillRect(0,0,cv.width,cv.height);hasStrokes=false;document.getElementById('status').textContent='írj a tollal…';}
function pen(w,id){pw=w;ctx.lineWidth=w;document.querySelectorAll('.sz').forEach(el=>el.classList.remove('on'));document.getElementById(id).classList.add('on');}

async function doOcr(){
  if(!hasStrokes){document.getElementById('status').textContent='Először írj valamit!';return;}
  const btn=document.getElementById('recBtn'),st=document.getElementById('status');
  btn.disabled=true;
  try{
    if(!window.Tesseract){
      st.textContent='⟳ betöltés…';
      await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=ok;s.onerror=fail;document.head.appendChild(s);});
    }
    if(!tess){
      st.textContent='⟳ modell…';
      tess=await Tesseract.createWorker('hun+eng',1,{logger:m=>{if(m.status==='recognizing text')st.textContent='⟳ '+Math.round(m.progress*100)+'%';}});
    }
    st.textContent='⟳ felismerés…';
    const res=await tess.recognize(cv);
    const txt=res.data.text.trim();
    if(txt){
      st.textContent='✓ kész';
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'ocr',text:txt}));
      clr();
    } else {
      st.textContent='Nem sikerült — próbáld újra';
    }
  }catch(e){
    st.textContent='Hiba: '+e.message;
    tess=null;
  }
  btn.disabled=false;
}
</script>
</body>
</html>`;

export default function NoteScreen() {
  const [mode, setMode] = useState('text'); // 'text' | 'draw'
  const [note, setNote] = useState('');
  const webRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(NOTE_KEY).then(v => { if (v) setNote(v); });
  }, []);

  function save(text) {
    setNote(text);
    AsyncStorage.setItem(NOTE_KEY, text);
  }

  function onMsg(e) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ocr' && msg.text) {
        const updated = note ? note + '\n' + msg.text : msg.text;
        save(updated);
        setMode('text');
      }
    } catch {}
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>NOTE</Text>
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.tBtn, mode === 'text' && s.tBtnOn]}
            onPress={() => setMode('text')}>
            <Ionicons name="create-outline" size={16} color={mode === 'text' ? C.cy : C.dim} />
            <Text style={[s.tTx, mode === 'text' && { color: C.cy }]}>Szöveg</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tBtn, mode === 'draw' && s.tBtnOn]}
            onPress={() => setMode('draw')}>
            <Ionicons name="pencil-outline" size={16} color={mode === 'draw' ? C.cy : C.dim} />
            <Text style={[s.tTx, mode === 'draw' && { color: C.cy }]}>Rajz</Text>
          </TouchableOpacity>
        </View>
        {note.length > 0 && (
          <TouchableOpacity onPress={() => save('')} style={s.clearBtn}>
            <Ionicons name="trash-outline" size={16} color={C.rd} />
          </TouchableOpacity>
        )}
      </View>

      {/* Text mode */}
      {mode === 'text' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TextInput
            style={s.input}
            value={note}
            onChangeText={save}
            multiline
            textAlignVertical="top"
            placeholder="Írj valamit… (billentyűzet vagy toll)"
            placeholderTextColor={C.dim}
            autoCorrect={false}
            scrollEnabled
          />
        </KeyboardAvoidingView>
      )}

      {/* Draw mode */}
      {mode === 'draw' && (
        <View style={{ flex: 1 }}>
          {note.length > 0 && (
            <View style={s.notePrev}>
              <Text style={s.notePrevTx} numberOfLines={2}>{note}</Text>
            </View>
          )}
          <View style={s.drawHint}>
            <Ionicons name="information-circle-outline" size={13} color={C.dim} />
            <Text style={s.hintTx}>Rajzolj, majd ✦ Szöveg — az eredmény a fenti szöveghez kerül</Text>
          </View>
          <WebView
            ref={webRef}
            source={{ html: CANVAS_HTML }}
            style={{ flex: 1, backgroundColor: '#08090e' }}
            onMessage={onMsg}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            // Régi eszközön: csökkentett render priority, kevesebb memory nyomás
            setBuiltInZoomControls={false}
            androidLayerType={IS_LOW_END ? 'software' : 'hardware'}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: C.line,
    backgroundColor: C.panel,
  },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: C.dim, marginRight: 12 },
  toggle: { flexDirection: 'row', gap: 4, flex: 1 },
  tBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.line,
  },
  tBtnOn: { borderColor: 'rgba(94,200,255,.3)', backgroundColor: 'rgba(94,200,255,.08)' },
  tTx: { fontSize: 12, fontWeight: '600', color: C.dim },
  clearBtn: { padding: 6, marginLeft: 4 },
  input: {
    flex: 1, color: C.tx, fontSize: 15, lineHeight: 24,
    padding: 16, backgroundColor: C.bg,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  notePrev: {
    margin: 12, marginBottom: 0,
    padding: 10, borderRadius: 8,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line,
  },
  notePrevTx: { fontSize: 12, color: C.tx, lineHeight: 18 },
  drawHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  hintTx: { fontSize: 11, color: C.dim, flex: 1 },
});
