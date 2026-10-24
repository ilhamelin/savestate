import type { GameLiveTelemetry } from '@/domain/game-live-telemetry';
import { GameLiveTelemetryView } from '@/components/game-live-telemetry-view';
const empty: GameLiveTelemetry = { steamAppId: null, steamCurrentPlayers: null, historicalLow: null, deals: [], twitchStreams: [], twitchTotalTopViewers: 0 };
const full: GameLiveTelemetry = {
  ...empty, steamAppId: 292030, steamCurrentPlayers: 68285, usdToClpRate: 985, historicalLow: { price: '7.09', dateIso: null }, twitchTotalTopViewers: 1442,
  deals: [
    { dealId:'gog',storeName:'GOG',normalPrice:'49.99',salePrice:'24.99',savingsPercent:50,dealUrl:'https://www.cheapshark.com/redirect?dealID=fixture-gog' },
    { dealId:'steam',storeName:'Steam',normalPrice:'49.99',salePrice:'49.99',savingsPercent:0,dealUrl:'https://www.cheapshark.com/redirect?dealID=fixture-steam' },
    { dealId:'epic',storeName:'Epic Games Store',normalPrice:'49.99',salePrice:'0.00',savingsPercent:100,dealUrl:'https://www.cheapshark.com/redirect?dealID=fixture-epic' }
  ],
  twitchStreams: Array.from({length:4},(_,i)=>({id:String(i),userName:['Freyja','TheDropCreator','TembraK','Tyrisftw'][i]!,userLogin:'fixture'+i,title:i===0?'Deathmarch!':i===1?'[DROPS] SUB = BUILD: '+ 'Una aventura de fantasía con una descripción muy larga '.repeat(5):i===2?'The Witcher 3 · Español LATAM':'[DROPY] WEEKEND',viewerCount:[940,244,155,103][i]!,language:'es',thumbnailUrl:'https://static-cdn.jtvnw.net/radar-fixture-'+i+'.jpg',streamUrl:'https://www.twitch.tv/fixture'+i}))
};
export default async function RadarQaPage({searchParams}:{searchParams:Promise<{empty?:string}>}) { const search=await searchParams;return <GameLiveTelemetryView title="The Witcher 3: Wild Hunt" data={search.empty?empty:full} />; }
