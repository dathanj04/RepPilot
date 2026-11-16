import {hasBusinessFeatures} from "@/lib/domain/paid-access";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { accountEditScope } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { RoutePlanner } from "@/components/route/route-planner";
import { readPlanning } from "@/lib/domain/route-planning";
import { parseOrgSettings } from "@/lib/org-settings";

export const instant = false;
export const metadata = { title: "Routes" };

export default async function RoutePage({ searchParams }: { searchParams: Promise<{ route?: string; add?: string }> }) {
  await connection();
  const user = await requireAppUser();
  const selected = await searchParams;
  const [routes, accounts, org] = await Promise.all([
    prisma.dailyRoute.findMany({where:{organizationId:user.organizationId,userId:user.id},orderBy:{updatedAt:"desc"},take:100,include:{stops:{orderBy:{position:"asc"},include:{account:true}}}}),
    prisma.account.findMany({where:{...accountEditScope(user),status:"ACTIVE"},orderBy:{name:"asc"},include:{
      tasks:{where:{status:"OPEN"},orderBy:{dueDate:"asc"},take:5,select:{title:true,dueDate:true}},
      referralSnapshots:{orderBy:{syncedAt:"desc"},take:1},
      interactions:{orderBy:{occurredAt:"desc"},take:1,include:{visitDetail:true}},
      visitBriefs:{orderBy:{createdAt:"desc"},take:1},
    }}),
    prisma.organization.findUniqueOrThrow({where:{id:user.organizationId}}),
  ]);
  const settings = parseOrgSettings(org.settings);
  const offices = accounts.map(a => {
    const snapshot=a.referralSnapshots[0], brief=a.visitBriefs[0]?.payload as {referralInsight?:string;talkingPoints?:string[]} | undefined;
    return {id:a.id,name:a.name,address:[a.street,a.city,a.state,a.zip].join(", "),lat:a.latitude,lng:a.longitude,lastVisit:a.lastVisitAt?.toISOString()??null,nextFollowUp:a.nextFollowUpAt?.toISOString()??null,
      lastReferral:snapshot?.lastReferralAt?.toISOString()??null,crm:snapshot ? (snapshot.syncStatus+" · "+(snapshot.count30??"Unknown")+" referrals in 30 days · synced "+snapshot.syncedAt.toISOString()) : "No verified CRM activity available.",
      tasks:a.tasks.map(t=>t.title),topic:a.interactions[0]?.visitDetail?.nextTopic || brief?.talkingPoints?.[0] || null};
  });
  return <RoutePlanner businessAccess={hasBusinessFeatures(user)} userId={user.id} timezone={user.timezone} workEnd={settings.workdayEnd} workStart={settings.workdayStart} offices={offices} requestedRoute={selected.route??null} addAccountId={selected.add??null} routes={routes.map(r=>({
    id:r.id,updatedAt:r.updatedAt.toISOString(),name:readPlanning(r.planning)?.name||r.summary||"Saved route",date:r.routeDate.toISOString(),
    planning:readPlanning(r.planning),legacy:r.stops.map(s=>({accountId:s.accountId,name:s.account.name,address:[s.account.street,s.account.city,s.account.state,s.account.zip].join(", "),lat:s.account.latitude,lng:s.account.longitude})),
  }))} />;
}
