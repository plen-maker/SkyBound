import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "../../src/theme";

async function loadOFPData(username) {
  const r = await fetch(
    `https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`,
    { headers: { Accept:"application/json" } }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d?.fetch?.status === "Error") throw new Error(d.fetch.message);
  const n = v => v==null||v===""?null:Number(v);
  const w=d.weights||{}, f=d.fuel||{}, g=d.general||{};
  return {
    dep:d?.origin?.icao_code, arr:d?.destination?.icao_code, altn:d?.alternate?.icao_code,
    aircraft:`${d?.aircraft?.icaocode||""} ${d?.aircraft?.name||""}`.trim(),
    units:w.units||"kg",
    pax:n(w.pax_count), payload:n(w.payload), zfw:n(w.est_zfw), tow:n(w.est_tow),
    blockFuel:n(f.plan_ramp), tripFuel:n(f.enroute_burn), contFuel:n(f.contingency),
    costindex:n(g.costindex), route:g.route,
    distNm:n(g.route_distance)||n(g.air_distance),
    fixes:(Array.isArray(d?.navlog?.fix)?d.navlog.fix:d?.navlog?.fix?[d.navlog.fix]:[])
      .map(x=>({ident:x.ident,stage:x.stage,alt:n(x.altitude_feet)})).filter(x=>x.ident),
  };
}

const Row = ({l,v}) => (
  <View style={{ flexDirection:"row", justifyContent:"space-between",
    paddingVertical:9, borderBottomColor:"#1a2a3d", borderBottomWidth:1 }}>
    <Text style={{ color:"#5a7090", fontSize:13 }}>{l}</Text>
    <Text style={{ color:"#cdd9ec", fontSize:13, fontFamily:"Courier New" }}>{v??"—"}</Text>
  </View>
);

export default function OFPScreen() {
  const [user,    setUser]    = useState("");
  const [ofp,     setOfp]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [tab,     setTab]     = useState("w");

  useEffect(()=>{
    AsyncStorage.getItem("sb_sbuser").then(v=>{ if(v){setUser(v);fetch_(v);} });
  },[]);

  const fetch_ = async (u=user) => {
    const un=(u||"").trim(); if(!un){setErr("Adj meg usernevet.");return;}
    setLoading(true);setErr("");
    try {
      const o = await Promise.race([
        loadOFPData(un),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("Timeout")),12000)),
      ]);
      setOfp(o); AsyncStorage.setItem("sb_sbuser",un);
    } catch(e){setErr(e.message);}
    setLoading(false);
  };

  const TABS=[["w","Weights"],["f","Fuel"],["r","Route"],["n","Navlog"]];

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:14,gap:12}}>
        <Text style={{fontSize:20,fontWeight:"700",color:C.tx}}>SimBrief OFP</Text>
        <View style={{flexDirection:"row",gap:8}}>
          <TextInput value={user} onChangeText={setUser} placeholder="SimBrief usernév"
            placeholderTextColor={C.dim} autoCapitalize="none" onSubmitEditing={()=>fetch_()}
            style={{flex:1,backgroundColor:C.p2,borderColor:C.line,borderWidth:1,
              borderRadius:10,color:C.tx,padding:10,fontSize:14,fontFamily:"Courier New"}}/>
          <Pressable onPress={()=>fetch_()} disabled={loading}
            style={{backgroundColor:C.cy,borderRadius:10,paddingHorizontal:18,justifyContent:"center"}}>
            {loading?<ActivityIndicator color="#070b12" size="small"/>:
              <Text style={{color:"#070b12",fontWeight:"700",fontSize:14}}>Betölt</Text>}
          </Pressable>
        </View>
        {!!err&&<Text style={{color:C.rd,fontSize:12}}>{err}</Text>}
        {ofp&&(<>
          <View style={{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:12}}>
            <Text style={{fontSize:18,fontWeight:"700",color:C.tx,fontFamily:"Courier New"}}>
              {ofp.dep||"?"}  →  {ofp.arr||"?"}
            </Text>
            {ofp.aircraft&&<Text style={{color:C.dim,fontSize:12,marginTop:3}}>{ofp.aircraft}</Text>}
          </View>
          <View style={{flexDirection:"row",gap:6,flexWrap:"wrap"}}>
            {TABS.map(([k,l])=>(
              <Pressable key={k} onPress={()=>setTab(k)}
                style={{paddingHorizontal:14,paddingVertical:6,borderRadius:99,
                  backgroundColor:tab===k?C.cy:C.p2,borderColor:C.line,borderWidth:1}}>
                <Text style={{color:tab===k?"#070b12":C.dim,fontWeight:"600",fontSize:12}}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{backgroundColor:C.panel,borderColor:C.line,borderWidth:1,borderRadius:14,padding:12}}>
            {tab==="w"&&(<>
              <Row l="PAX"     v={ofp.pax}/>
              <Row l="Payload" v={ofp.payload!=null?`${ofp.payload} ${ofp.units}`:null}/>
              <Row l="ZFW"     v={ofp.zfw!=null?`${ofp.zfw} ${ofp.units}`:null}/>
              <Row l="TOW"     v={ofp.tow!=null?`${ofp.tow} ${ofp.units}`:null}/>
              <Row l="CI"      v={ofp.costindex}/>
            </>)}
            {tab==="f"&&(<>
              <Row l="Block"  v={ofp.blockFuel!=null?`${ofp.blockFuel} ${ofp.units}`:null}/>
              <Row l="Trip"   v={ofp.tripFuel!=null?`${ofp.tripFuel} ${ofp.units}`:null}/>
              <Row l="Cont"   v={ofp.contFuel!=null?`${ofp.contFuel} ${ofp.units}`:null}/>
              <Row l="Dist"   v={ofp.distNm?`${ofp.distNm} nm`:null}/>
            </>)}
            {tab==="r"&&(
              <Text style={{color:C.tx,fontFamily:"Courier New",fontSize:12,lineHeight:18}}>
                {ofp.route||"—"}
              </Text>
            )}
            {tab==="n"&&ofp.fixes.map((f,i)=>(
              <View key={f.ident+i} style={{flexDirection:"row",paddingVertical:7,
                borderBottomColor:C.line,borderBottomWidth:1}}>
                <Text style={{color:C.cy,fontFamily:"Courier New",width:72}}>{f.ident}</Text>
                <Text style={{color:C.dim,flex:1,fontSize:12}}>{f.stage||"—"}</Text>
                <Text style={{color:C.tx,fontFamily:"Courier New",fontSize:12}}>{f.alt??"—"}</Text>
              </View>
            ))}
          </View>
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}
