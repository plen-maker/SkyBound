import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../src/theme";

const FAC={0:"OBS",1:"FSS",2:"DEL",3:"GND",4:"TWR",5:"APP",6:"CTR"};
const FC={DEL:"#a78bfa",GND:C.gn,TWR:C.cy,APP:C.am,CTR:C.rd,FSS:"#94a3b8",OBS:C.dim};

export default function VatsimScreen() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [opened,  setOpened]  = useState({});

  const load = async () => {
    setLoading(true);
    try { const r=await fetch("https://data.vatsim.net/v3/vatsim-data.json"); setData(await r.json()); }
    catch {}
    setLoading(false);
  };
  useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t);},[]);

  const atisMap={};
  (data?.atis||[]).forEach(a=>{atisMap[a.callsign]=a;});
  const ctrls=(data?.controllers||[]).filter(c=>c.facility>0).slice(0,60);

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:14,gap:8}}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
          <Text style={{fontSize:20,fontWeight:"700",color:C.tx}}>VATSIM ATC</Text>
          <Pressable onPress={load} style={{padding:8,backgroundColor:C.p2,borderRadius:8,borderColor:C.line,borderWidth:1}}>
            <Text style={{color:C.cy,fontSize:12}}>↻</Text>
          </Pressable>
        </View>
        {loading&&!data&&<ActivityIndicator color={C.cy} style={{paddingTop:20}}/>}
        {!loading&&ctrls.length===0&&<Text style={{color:C.dim,textAlign:"center",paddingTop:20}}>Nincs online ATC.</Text>}
        {ctrls.map(c=>{
          const fac=FAC[c.facility]||"CTR", fc=FC[fac]||C.dim;
          const atis=atisMap[c.callsign];
          const open=opened[c.callsign];
          return(
            <Pressable key={c.callsign}
              onPress={()=>atis&&setOpened(p=>({...p,[c.callsign]:!p[c.callsign]}))}
              style={{flexDirection:"row",alignItems:"flex-start",gap:10,
                backgroundColor:C.panel,borderColor:open?fc:C.line,borderWidth:1,borderRadius:14,padding:12}}>
              <View style={{borderRadius:6,paddingHorizontal:7,paddingVertical:3,
                backgroundColor:fc+"18",borderColor:fc+"40",borderWidth:1}}>
                <Text style={{fontSize:10,fontWeight:"700",color:fc}}>{fac}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{color:C.tx,fontWeight:"600",fontFamily:"Courier New",fontSize:13}}>
                  {c.callsign}{atis?<Text style={{color:C.cy,fontSize:11}}> ATIS {atis.atis_code}</Text>:null}
                </Text>
                <Text style={{color:C.dim,fontSize:11,marginTop:1}}>{c.name}</Text>
                {open&&atis&&<Text style={{color:C.dim,fontSize:11,marginTop:6,fontFamily:"Courier New",lineHeight:15}}>
                  {atis.text_atis?.join(" ")}
                </Text>}
              </View>
              <Text style={{fontFamily:"Courier New",fontSize:13,color:C.am}}>{c.frequency}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
