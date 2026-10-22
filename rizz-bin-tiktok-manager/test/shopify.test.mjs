import test from 'node:test';
import assert from 'node:assert/strict';
import {getProduct,listActiveProducts,publishTikTok} from '../src/shopify.mjs';

const domain = process.env.SHOPIFY_SHOP_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const confirmation = process.env.RIZZ_PUBLISH_CONFIRM;
const originalFetch = globalThis.fetch;
const pid='gid://shopify/Product/9080911167678';
const sample={
  id:pid,title:'EasyClean Soap-Dispensing Dish Brush',status:'ACTIVE',
  featuredMedia:{image:{url:'https://cdn.shopify.com/brush.webp',altText:'Dish brush'}},
  description:'Real verified description with product specifications from supplier.',vendor:'Luminous Bear Shop',
  productType:'Kitchen',media:{nodes:[{image:{url:'https://cdn.shopify.com/brush.webp'}}],pageInfo:{hasNextPage:false}},
  variants:{nodes:[{id:'gid://shopify/ProductVariant/49335296000190',title:'purple',sku:'SO54AEY45HA',price:'5.25',inventoryQuantity:50,inventoryPolicy:'DENY',requiresComponents:false,selectedOptions:[{name:'Color',value:'purple'}],inventoryItem:{requiresShipping:true,unitCost:{amount:'3.68',currencyCode:'USD'}}}],pageInfo:{hasNextPage:false}}
};
function restore() {
  if(domain === undefined) delete process.env.SHOPIFY_SHOP_DOMAIN; else process.env.SHOPIFY_SHOP_DOMAIN=domain;
  if(token === undefined) delete process.env.SHOPIFY_ADMIN_TOKEN; else process.env.SHOPIFY_ADMIN_TOKEN=token;
  if(confirmation === undefined) delete process.env.RIZZ_PUBLISH_CONFIRM; else process.env.RIZZ_PUBLISH_CONFIRM=confirmation;
  globalThis.fetch=originalFetch;
}
test.after(restore);

test('reads real Shopify 2026-10 featuredMedia, specs and images; never queries removed featuredImage field',async()=>{
  process.env.SHOPIFY_SHOP_DOMAIN='the-rizz-bin.myshopify.com';
  process.env.SHOPIFY_ADMIN_TOKEN='test-secret-only';
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.match(url,/the-rizz-bin\.myshopify\.com/);
    const sent=JSON.parse(options.body);
    assert.match(sent.query,/featuredMedia/);
    assert.doesNotMatch(sent.query,/featuredImage\s*\{/);
    assert.match(sent.query,/selectedOptions/);
    return {ok:true,json:async()=>({data:{product:sample}})};
  };
  const p=await getProduct(pid);
  assert.equal(calls,1);
  assert.equal(p.featuredImage.url,'https://cdn.shopify.com/brush.webp');
  assert.equal(p.variants.nodes[0].selectedOptions[0].value,'purple');
});

test('catalog images are normalized before audits',async()=>{
  process.env.SHOPIFY_SHOP_DOMAIN='the-rizz-bin.myshopify.com';
  process.env.SHOPIFY_ADMIN_TOKEN='test-secret-only';
  globalThis.fetch=async()=>({ok:true,json:async()=>({data:{products:{nodes:[sample],pageInfo:{hasNextPage:false}}}})});
  const p=await listActiveProducts();
  assert.equal(p.length,1);
  assert.equal(p[0].featuredImage.url,'https://cdn.shopify.com/brush.webp');
});

test('publisher cannot mutate even when imported directly without explicit approval',async()=>{
  delete process.env.RIZZ_PUBLISH_CONFIRM;
  let network=false;
  globalThis.fetch=async()=>{network=true;throw Error('unexpected network operation')};
  await assert.rejects(publishTikTok(pid,'gid://shopify/Publication/207469838526',{reviewed:true,productId:pid,publicationId:'gid://shopify/Publication/207469838526'}),/Publication blocked/);
  assert.equal(network,false);
});

test('Shopify credentials reject a mismatched store before network request',async()=>{
  process.env.SHOPIFY_SHOP_DOMAIN='someone-else.myshopify.com';
  process.env.SHOPIFY_ADMIN_TOKEN='test-secret-only';
  let network=false;
  globalThis.fetch=async()=>{network=true;throw Error('unexpected network operation')};
  await assert.rejects(getProduct(pid),/wrong Shopify shop domain/);
  assert.equal(network,false);
});
