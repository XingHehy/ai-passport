import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBuildUpdate } from './web/reload.mjs';

test('external build overwriting served files cannot cause repeated reloads', async () => {
  let fetches = 0;
  const published = async () => {fetches++; return {ok:true,json:async()=>({id:'external-build'})};};
  for(let poll=0;poll<5;poll++) {
    assert.equal(await checkBuildUpdate('external-build','old-server-build',published),'conflict');
  }
  assert.equal(fetches,5);
});
test('normal successful rebuild reloads once and settles after boot', async () => {
  const published = async()=>({ok:true,json:async()=>({id:'new-build'})});
  assert.equal(await checkBuildUpdate('old-build','new-build',published),'reload');
  assert.equal(await checkBuildUpdate('new-build','new-build',()=>{throw Error('No fetch for unchanged build');}),'current');
});
test('unavailable build manifest preserves the current preview', async () => {
  assert.equal(await checkBuildUpdate('old-build','new-build',async()=>({ok:false})),'unavailable');
});
