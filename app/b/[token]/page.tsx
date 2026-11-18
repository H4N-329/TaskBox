import Board from '../../board';export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <Board token={token}/>}
