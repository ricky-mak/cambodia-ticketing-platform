import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { releaseExpiredHolds } from "@/services/order.service";
import { getDataSource } from "@/lib/database";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const result = await releaseExpiredHolds();
  console.log(
    `Expired ${result.expiredOrders} pending order(s) and released their seats.`,
  );
  await (await getDataSource()).destroy();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
