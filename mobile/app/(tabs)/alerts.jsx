import React, { useState } from "react";
import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTriggers } from "../../src/useLive";
import { C } from "../../src/theme";

export default function AlertsScreen() {
  const { triggers, add, del, toggle } = useTriggers();
  const [kind,setKind]=useState("fix");
  const [fix, setFix] =useState("VETIK");
  const [lead,setLead]=useState("5");

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{flex:1,padding:14,gap:12}}>
        <Text style={{fontSize:20,fontWeight:"700",color:C.tx}}>Push Triggers</Text>
        <View style={{flexDirection:"row",gap:6}}>
          {[["fix","Fix"],["tod","T/D"],["dest","Landing"]].map(([k,l])=>(
            <Pressable key={k} onPress={()=>setKind(k)}
              style={{paddingHorizontal:14,paddingVertical:7,borderRadius:99,
                backgroundColor:kind===k?C.cy:C.p2,borderColor:C.line,borderWidth:1}}>
              <Text style={{color:kind===k?"#070b12":C.dim,fontWeight:"600",fontSize:13}}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{flexDirection:"row",gap:8,alignItems:"flex-end"}}>
          {kind==="fix"&&(
            <TextInput value={fix} onChangeText={setFix} placeholder="Fix" placeholderTextColor={C.dim}
              autoCapitalize="characters"
              style={{flex:1,backgroundColor:C.p2,borderColor:C.line,borderWidth:1,
                borderRadius:10,color:C.tx,padding:10,fontSize:14,fontFamily:"Courier New"}}/>
          )}
          <TextInput value={lead} onChangeText={setLead} placeholder="min" placeholderTextColor={C.dim}
            keyboardType="number-pad"
            style={{width:70,backgroundColor:C.p2,borderColor:C.line,borderWidth:1,
              borderRadius:10,color:C.tx,padding:10,fontSize:14,fontFamily:"Courier New"}}/>
          <Pressable onPress={()=>{
            if(kind==="fix"&&!fix.trim())return;
            add({kind,lead:Number(lead)||5,...(kind==="fix"?{fix:fix.toUpperCase()}:{})});
          }} style={{backgroundColor:C.cy,borderRadius:10,paddingHorizontal:18,paddingVertical:10}}>
            <Text style={{color:"#070b12",fontWeight:"700",fontSize:14}}>Arm</Text>
          </Pressable>
        </View>
        <FlatList
          data={triggers}
          keyExtractor={t=>t.id}
          contentContainerStyle={{gap:8}}
          ListEmptyComponent={<Text style={{color:C.dim,textAlign:"center",paddingTop:20}}>Nincs trigger.</Text>}
          renderItem={({item:t})=>(
            <View style={{flexDirection:"row",alignItems:"center",gap:12,
              backgroundColor:C.panel,borderColor:t.fired?C.gn:C.line,borderWidth:1,borderRadius:14,padding:12}}>
              <Pressable onPress={()=>toggle(t.id,!t.armed)}
                style={{width:26,height:26,borderRadius:6,backgroundColor:t.armed?C.cy:C.p2,
                  borderColor:C.line,borderWidth:1}}/>
              <View style={{flex:1}}>
                <Text style={{color:C.tx,fontWeight:"600",fontFamily:"Courier New",fontSize:14}}>
                  {t.kind==="fix"?t.fix:t.kind.toUpperCase()}
                  <Text style={{color:C.dim}}> − {t.lead} min</Text>
                </Text>
                <Text style={{color:t.armed?(t.fired?C.gn:C.cy):C.dim,fontSize:11,marginTop:1}}>
                  {t.armed?(t.fired?"✓ fired":"armed"):"off"}
                </Text>
              </View>
              <Pressable onPress={()=>del(t.id)}
                style={{paddingHorizontal:10,paddingVertical:6,backgroundColor:C.p2,
                  borderColor:C.line,borderWidth:1,borderRadius:8}}>
                <Text style={{color:C.rd,fontWeight:"600"}}>Del</Text>
              </Pressable>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
