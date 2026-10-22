import test from 'node:test';
import assert from 'node:assert/strict';
import {buildListingPreview,assessListingReview} from '../src/listing.mjs';

const product={
  id:'gid://shopify/Product/123',title:'Kitchen Dish Brush Kit',
  description:'An actual supplier-confirmed kitchen dish brush set with documented specifications and included pieces.',
  vendor:'Supplier',productType:'Kitchen',
  featuredImage:{url:'https://cdn.shopify.com/brush.jpg'},
  media:{nodes:[{image:{url:'https://cdn.shopify.com/brush.jpg'}},{image:{url:'https://cdn.shopify.com/details.jpg'}}],pageInfo:{hasNextPage:false}},
  variants:{nodes:[{id:'gid://shopify/ProductVariant/456',sku:'BR-10',title:'Natural',price:'18.99',selectedOptions:[{name:'Color',value:'Natural'}]}],pageInfo:{hasNextPage:false}}
};
const details={
  categoryId:'1234567',categoryEvidence:'TikTok Seller Center category screenshot',
  specs:{
    materials:{value:'Bamboo and sisal',source:'Supplier data sheet 2026-10-22'},
    dimensions:{value:'8 x 5 x 4 cm',source:'Supplier dimensions sheet 2026-10-22'},
    packageContents:{value:'Three brushes',source:'Supplier packing list 2026-10-22'}
  }
};

test('verified title, description, evidence, photos and options produce a stable preview',()=>{
  const p=buildListingPreview(product,details);
  assert.equal(p.readyForOwnerReview,true);
  assert.equal(p.listing.photos.length,2);
  assert.equal(p.listing.variants[0].optionValues[0].value,'Natural');
  assert.equal(p.fingerprint,buildListingPreview(product,details).fingerprint);
});
test('missing dimensions and unsupported text do not turn into fabricated specs',()=>{
  const p=buildListingPreview(product,{...details,specs:{...details.specs,dimensions:{value:'approx 8cm'}}});
  assert.equal(p.listing.specs.dimensions,undefined);
  assert.equal(p.readyForOwnerReview,false);
});
test('owner must approve exact listing fingerprint',()=>{
  const p=buildListingPreview(product,details);
  assert.equal(assessListingReview(p,{listingReview:{approved:true,fingerprint:p.fingerprint}}).eligible,true);
  assert.equal(assessListingReview(p,{listingReview:{approved:true,fingerprint:'old'}}).eligible,false);
});
test('changed Shopify description invalidates earlier approval',()=>{
  const p=buildListingPreview(product,details);
  const changed=buildListingPreview({...product,description:product.description+' Updated.'},details);
  assert.notEqual(p.fingerprint,changed.fingerprint);
  assert.equal(assessListingReview(changed,{listingReview:{approved:true,fingerprint:p.fingerprint}}).eligible,false);
});
test('a missing SKU, photo, category or short description is blocked',()=>{
  const p=buildListingPreview({...product,description:'short',featuredImage:null,media:{nodes:[]},variants:{nodes:[{...product.variants.nodes[0],sku:null}]}},{...details,categoryId:null});
  assert.equal(p.readyForOwnerReview,false);
  assert.ok(p.issues.length>=4);
});
test('no approval cannot publish despite plausible specs',()=>{
  const p=buildListingPreview(product,details);
  assert.equal(assessListingReview(p,null).eligible,false);
});
