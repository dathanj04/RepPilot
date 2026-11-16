import "server-only";
import {getCurrentUser} from "./auth";
import {hasBusinessFeatures,BUSINESS_UPGRADE} from "./domain/paid-access";
export async function getBusinessUser(){
 const user=await getCurrentUser();
 if(!hasBusinessFeatures(user))throw Error(BUSINESS_UPGRADE);
 return user;
}
