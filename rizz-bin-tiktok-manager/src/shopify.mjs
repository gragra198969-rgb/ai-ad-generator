const API_VERSION = "2026-10";
const EXPECTED_DOMAIN = "the-rizz-bin.myshopify.com";

function credentials() {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (domain !== EXPECTED_DOMAIN) throw Error("Blocked: wrong Shopify shop domain");
  if (!token) throw Error("Missing SHOPIFY_ADMIN_TOKEN secret");
  return {domain,token};
}

export async function shopify(query, variables={}) {
  const {domain,token} = credentials();
  const response = await fetch("https://" + domain + "/admin/api/" + API_VERSION + "/graphql.json", {
    method:"POST",
    headers:{"content-type":"application/json","X-Shopify-Access-Token":token},
    body:JSON.stringify({query,variables}),
    signal:AbortSignal.timeout(20000)
  });
  if (!response.ok) throw Error("Shopify HTTP status " + response.status);
  const payload = await response.json();
  if (payload.errors?.length) throw Error("Shopify GraphQL: " + payload.errors.map(x=>x.message).join("; "));
  if (!payload.data) throw Error("Shopify returned no data");
  return payload.data;
}

const PRODUCT_FIELDS = "id title status featuredMedia{... on MediaImage{image{url altText}}} variants(first:100){nodes{id title sku selectedOptions{name value} price inventoryQuantity inventoryPolicy requiresComponents inventoryItem{requiresShipping unitCost{amount currencyCode}}}pageInfo{hasNextPage}}";
function normalizeProduct(product) {
  if (!product) return product;
  // Shopify Admin 2026-10 provides featuredMedia, not featuredImage. Adapt it for the review engine.
  const url = product.featuredMedia?.image?.url;
  return {...product, featuredImage: url ? {url} : null};
}
const LISTING_FIELDS = PRODUCT_FIELDS + " description vendor productType media(first:15){nodes{... on MediaImage{image{url altText}}}pageInfo{hasNextPage}}";

export async function getProduct(productId) {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(productId || "")) throw Error("Expected Shopify product GID");
  const data = await shopify("query($id:ID!){product(id:$id){" + LISTING_FIELDS + "}}",{id:productId});
  if (!data.product) throw Error("Shopify product not found");
  return normalizeProduct(data.product);
}

export async function listActiveProducts() {
  const all = [];
  let after = null;
  do {
    const data = await shopify("query($after:String){products(first:50,after:$after,query:\"status:active\"){nodes{" + PRODUCT_FIELDS + "}pageInfo{hasNextPage endCursor}}}",{after});
    all.push(...data.products.nodes.map(normalizeProduct));
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
    if (all.length > 1000) throw Error("Safety stop: unexpected catalog size");
  } while (after);
  return all;
}

export async function getTikTokPublication() {
  const id = process.env.SHOPIFY_TIKTOK_PUBLICATION_ID;
  if (!/^gid:\/\/shopify\/Publication\/\d+$/.test(id || "")) throw Error("Set the verified SHOPIFY_TIKTOK_PUBLICATION_ID");
  // This shop-specific ID was verified against the connected Shopify TikTok channel.
  // Fail closed rather than accidentally publishing to another live sales channel.
  if (id !== "gid://shopify/Publication/207469838526") throw Error("Refusing unverified TikTok publication ID");
  const data = await shopify("query{channels(first:50){nodes{id name handle}}publications(first:50){nodes{id}}}");
  if (!data.channels?.nodes?.some(x=>x.name==="TikTok" && x.handle?.startsWith("tiktok"))) throw Error("TikTok sales channel not installed");
  if (!data.publications?.nodes?.some(x=>x.id===id)) throw Error("TikTok publication ID not present in this Shopify shop");
  return id;
}

export async function checkTikTokStatus(productId, publicationId) {
  const data = await shopify("query($id:ID!,$pub:ID!){product(id:$id){id title status publishedOnPublication(publicationId:$pub)}}",{id:productId,pub:publicationId});
  if (!data.product) throw Error("Product not found");
  return data.product;
}

export async function publishTikTok(productId, publicationId, authorization) {
  // Safety check at the API boundary, not just inside the command-line caller.
  if (process.env.RIZZ_PUBLISH_CONFIRM !== "YES_PUBLISH_THIS_PRODUCT" || authorization?.reviewed !== true || authorization?.productId !== productId || authorization?.publicationId !== publicationId) throw Error("Publication blocked: reviewed product, verified channel and explicit confirmation required");
  if (publicationId !== "gid://shopify/Publication/207469838526") throw Error("Publication blocked: TikTok channel ID not verified");
  const query = "mutation($id:ID!,$pub:ID!){publishablePublish(id:$id,input:[{publicationId:$pub}]){publishable{publishedOnPublication(publicationId:$pub)}userErrors{field message}}}";
  const data = await shopify(query,{id:productId,pub:publicationId});
  const result = data.publishablePublish;
  if (result?.userErrors?.length) throw Error("Publication rejected: " + result.userErrors.map(e=>e.message).join("; "));
  if (result?.publishable?.publishedOnPublication !== true) throw Error("Shopify has not confirmed TikTok-channel publication");
  return {productId,publicationId,shopifyTikTokChannelPublished:true,tikTokSellerCenterApproved:false};
}
