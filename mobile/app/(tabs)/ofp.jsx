import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function fetchOFP(username) {
  const r = await fetch(
    `https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d?.fetch?.status === "Error") throw new Error(d.fetch.message);
  const w=d.weights||{},f=d.fuel||{},g=d.general||{};
  const n = v => v==null||v===""?null:Number(v);
  return {
    dep: d?.origin?.icao_code, arr: d?.destination?.icao_code, altn: d?.alternate?.icao_code,
    aircraft: `${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim(),
    units: w.units||"kg",
    pax: n(w.pax_count), payload: n(w.payload), zfw: n(w.est_zfw), tow: n(w.est_tow),
    blockFuel: n(f.plan_ramp), enrouteBurn: n(f.enroute_burn), contFuel: n(f.contingency),
    costindex: n(g.costindex), route: g.route,
    routeDistNm: n(g.route_distance)||n(g.air_distance),
    fixes: (Array.isArray(d?.navlog?.fix)?d.navlog.fix:d?.navlog?.fix?[d.navlog.fix]:[])
      .map(x=>({ident:x.ident,stage:x.stage,altitude:n(x.altitude_feet)})).filter(x=>x.ident),
  };
}

export default function OFPScreen() {
  const [sbUser, setSbUser] = useState("");
  const [ofp,    setOfp]    = useState(null);
  const [loading,setLoading]= useState(false);
  const [err,    setErr]    = useState("");
  const [tab,    setTab]    = useState("weights"); // weights|fuel|route|navlog

  React.useEffect(()=>{
    AsyncStorage.getItem("sb_user").then(v=>{ if(v){setSbUser(v);doLoad(v);} });
  },[]);

  const doLoad = useCallback(async (u=sbUser) => {
    const un=(u||"").trim();
    if(!un){setErr("Adj meg SimBrief usernevet.");return;}
    setLoading(true);setErr("");
    try {
      const o = await Promise.race([
        fetchOFP(un),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("Timeout")),12000)),
      ]);
      setOfp(o); await AsyncStorage.setItem("sb_user",un);
    } catch(e){setErr(e.message);}
    setLoading(false);
  },[sbUser]);

  const TABS = [["weights","Weights"],["fuel","Fuel"],["route","Route"],["navlog","Navlog"]];
  const Row = ({l,v}) => (
    <View style={s.row}>
      <Text style={{color:C.dim,fontSize:13}}>{l}</Text>
      <Text style={{color:C.tx,fontSize:13,fontFamily:"Courier New"}}>{v??"—"}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={s.cont}>
        <Text style={s.title}>SimBrief OFP</Text>

        <View style={s.fetchBar}>
          <TextInput value={sbUser} onChangeText={setSbUser} placeholder="SimBrief usernév"
            placeholderTextColor={C.dim} autoCapitalize="none"
            onSubmitEditing={()=>doLoad()} style={[s.inp,{flex:1}]}/>
          <Pressable onPress={()=>doLoad()} disabled={loading} style={s.loadBtn}>
            {loading
              ? <ActivityIndicator color="#070b12" size="small"/>
              : <Text style={s.loadTx}>Betölt</Text>}
          </Pressable>
        </View>

        {!!err && <Text style={s.err}>{err}</Text>}

        {ofp && (<>
          <View style={s.panel}>
            <Text style={s.route}>{ofp.dep||"?"}  →  {ofp.arr||"?"}</Text>
            {ofp.aircraft&&<Text style={{color:C.dim,fontSize:12,marginTop:2}}>{ofp.aircraft}</Text>}
          </View>

          <View style={s.tabRow}>
            {TABS.map(([k,l])=>(
              <Pressable key={k} onPress={()=>setTab(k)}
                style={[s.tabBtn, tab===k&&s.tabBtnOn]}>
                <Text style={[s.tabTx, tab===k&&s.tabTxOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {tab==="weights"&&(
            <View style={s.panel}>
              <Row l="PAX"     v={ofp.pax}/>
              <Row l="Payload" v={ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null}/>
              <Row l="ZFW"     v={ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:null}/>
              <Row l="TOW"     v={ofp.tow!=null?`${ofp.tow} ${ofp.units}`:null}/>
              <Row l="CI"      v={ofp.costindex}/>
            </View>
          )}
          {tab==="fuel"&&(
            <View style={s.panel}>
              <Row l="Block"       v={ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:null}/>
              <Row l="Trip burn"   v={ofp.enrouteBurn!=null?`${ofp.enrouteBurn} ${ofp.units}`:null}/>
              <Row l="Contingency" v={ofp.contFuel!=null?`${ofp.contFuel} ${ofp.units}`:null}/>
              <Row l="Dist"        v={ofp.routeDistNm?`${ofp.routeDistNm} nm`:null}/>
            </View>
          )}
          {tab==="route"&&(
            <View style={s.panel}>
              <Text style={{color:C.dim,fontSize:10,letterSpacing:1,marginBottom:6}}>ATC ROUTE</Text>
              <Text style={{color:C.tx,fontFamily:"Courier New",fontSize:12,lineHeight:18,flexWrap:"wrap"}}>
                {ofp.route||"—"}
              </Text>
            </View>
          )}
          {tab==="navlog"&&(
            <View style={s.panel}>
              {ofp.fixes.map((f,i)=>(
                <View key={f.ident+i} style={[s.row,{borderBottomColor:C.line,borderBottomWidth:1}]}>
                  <Text style={{color:C.cy,fontFamily:"Courier New",width:70}}>{f.ident}</Text>
                  <Text style={{color:C.dim,flex:1,fontSize:12}}>{f.stage||"—"}</Text>
                  <Text style={{color:C.tx,fontFamily:"Courier New",fontSize:12}}>{f.altitude??  "—"}</Text>
                </View>
              ))}
            </View>
          )}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  cont:    { padding:16,gap:12 },
  title:   { fontSize:20,fontWeight:"700",color:C.tx },
  fetchBar:{ flexDirection:"row",gap:8,alignItems:"center" },
  inp:     { backgroundColor:C.p2,borderColor:C.line,borderWidth:1,borderRadius:10,
             color:C.tx,padding:10,fontSize:14,fontFamily:"Courier New" },
  loadBtn: { backgroundColor:C.cy,borderRadius:10,paddingHorizontal:18,paddingVertical:10 },
  loadTx:  { color:"#070b12",fontWeight:"700",fontSize:14 },
  err:     { color:C.rd,fontSize:12 },
  panel:   { backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:12,gap:0 },
  route:   { fontSize:18,fontWeight:"700",color:C.tx,fontFamily:"Courier New" },
  tabRow:  { flexDirection:"row",gap:6,flexWrap:"wrap" },
  tabBtn:  { paddingHorizontal:14,paddingVertical:6,borderRadius:99,backgroundColor:C.p2,borderColor:C.line,borderWidth:1 },
  tabBtnOn:{ backgroundColor:C.cy },
  tabTx:   { color:C.dim,fontWeight:"600",fontSize:12 },
  tabTxOn: { color:"#070b12" },
  row:     { flexDirection:"row",justifyContent:"space-between",paddingVertical:8 },
});
