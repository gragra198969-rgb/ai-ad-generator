#!/usr/bin/env node
import {readFileSync} from "node:fs";
import {assessProduct} from "./core.mjs";
import {listActiveProducts,getProduct,getTikTokPublication,checkTikTokStatus,publishTikTok} from "./shopify.mjs";

function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;}
function approval(){const file=arg("--approval");return file?JSON.parse(readFileSync(file,"utf8")):null;}
const command=process.argv[2];
const help = "Usage:\n  npm run audit -- [--product gid://shopify/Product/ID] [--approval approvals/private.json]\n  npm run status -- --product gid://shopify/Product/ID\n  npm run publish -- --product gid://shopify/Product/ID --approval approvals/private.json --confirm\n\nPublishing requires VERIFIED margin and shipping evidence, owner approval, AND RIZZ_PUBLISH_CONFIRM=YES_PUBLISH_THIS_PRODUCT.\nNothing publishes automatically. No ads, purchases or supplier orders.\n";
async function main() {
  if (!["audit","status","publish"].includes(command)) {console.log(help);if(command&&command!=="help")process.exitCode=1;return;}
  const id=arg("--product");
  if (command!=="audit"&&!id) throw Error("--product required");
  if (command==="audit") {
    const record=approval();
    const products=id?[await getProduct(id)]:await listActiveProducts();
    console.log(JSON.stringify(products.map(p=>assessProduct(p,record?.productId===p.id?record:null)),null,2));
    return;
  }
  const pub=await getTikTokPublication();
  if (command==="status") {
    const status=await checkTikTokStatus(id,pub);
    console.log(JSON.stringify({productId:id,shopifyTikTokChannelPublished:status.publishedOnPublication,tikTokShopStatus:"Check Shopify TikTok channel / Seller Center"},null,2));
    return;
  }
  // No network mutation can occur before these approval and margin checks.
  const product=await getProduct(id);
  const report=assessProduct(product,approval());
  console.log(JSON.stringify(report,null,2));
  if (!report.eligible) throw Error("Not published: eligibility checks failed");
  if (!process.argv.includes("--confirm") || process.env.RIZZ_PUBLISH_CONFIRM!=="YES_PUBLISH_THIS_PRODUCT") throw Error("Not published: explicit confirmation required");
  const status=await checkTikTokStatus(id,pub);
  if (status.publishedOnPublication) {console.log("Already available to Shopify TikTok channel. Check TikTok Seller Center approval.");return;}
  console.log(JSON.stringify(await publishTikTok(id,pub),null,2));
}
main().catch(e=>{console.error("ERROR: " + e.message);process.exitCode=1;});
