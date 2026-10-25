import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { ResilientWidgetBoundary } from '@/components/resilient-widget-boundary';
import { ResilientServerWidget } from '@/components/resilient-server-widget';
import { GameAchievementsView } from '@/components/game-achievements';
import { GameMetaView } from '@/components/game-meta-hub';
import { ClientFault } from '@/components/game-detail-qa-client';
import type { GameAchievementsReport } from '@/domain/game-achievements';
import type { GameMetaReport } from '@/domain/game-meta';

function RenderFailure(): never { throw Error('SIMULATED secondary render failure'); }
function OldImageFailure() { return <img src="/fixture.png" alt="" onError={()=>{}}/>; }
async function Widget({slot,fault}:{slot:string;fault:string}) {
  await new Promise(resolve=>setTimeout(resolve,80));
  if(slot==='radar'&&fault==='load')throw Error('SIMULATED network timeout');
  if(slot==='meta'&&fault==='render')return <RenderFailure/>;
  if(slot==='critic'&&fault==='serialization')return <OldImageFailure/>;
  if(slot==='forum'&&fault==='client')return <ClientFault/>;
  if(slot==='meta'){
    const data:GameMetaReport={duration:null,proton:null,speedrun:{categoryName:'Any%',timeFormatted:'01:23',runnerName:'Player',dateIso:'INVALID DATE',videoUrl:null,speedrunUrl:'https://www.speedrun.com/'}};
    return <GameMetaView title="God of War" data={data}/>;
  }
  if(slot==='achievements'){
    const report:GameAchievementsReport={appId:1593500,communityUrl:null,hasAchievements:true,totalAchievements:1,
      summary:{total:1,platinoCount:1,oroCount:0,plataCount:0,bronceCount:0,hiddenCount:0,averageUnlockRate:0,rarestAchievement:null},
      achievements:[{id:'ACH_1',apiName:'ACH_1',name:'Healthy trophy',description:'Still available',hidden:false,iconUrl:'/fixture-achievement.png',unlockedPercentage:NaN,tier:'platino'}]};
    return <GameAchievementsView report={report}/>;
  }
  return <p data-healthy-slot={slot}>{slot} healthy</p>;
}
export default async function Page({searchParams}:{searchParams:Promise<{fault?:string}>}){
  const {fault='healthy'}=await searchParams;
  const jar=await cookies();
  if(fault==='fatal'&&jar.get('s19_recovered')?.value!=='1')throw Error('SIMULATED fatal game fault');
  return <><h1>God of War</h1><p>Core synopsis remains available.</p><a href="#write-review">Escribir reseña</a>
    {['radar','meta','critic','achievements','forum'].map(slot=><ResilientWidgetBoundary key={slot} widgetName={slot} fallback={<p data-widget-fallback={slot}>Widget unavailable</p>}>
      <Suspense fallback={<p>Loading {slot}</p>}><ResilientServerWidget widgetName={slot} load={()=>Widget({slot,fault})}/></Suspense>
    </ResilientWidgetBoundary>)}
    <section id="write-review"><h2>Tu reseña</h2><textarea aria-label="Reseña"/></section>
  </>;
}
