import {connection} from "next/server";
import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";
export const metadata={title:"Subscriptions"};
export const instant=false;
export default async function TrialPage(){
 await connection();
 await getCurrentUser({allowExpiredTrial:true});
 redirect("/billing?trial=ended");
}
