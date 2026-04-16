/** Upstream OCS API type definitions based on API.md */

export interface UpstreamTemplate {
  prepaidpackagetemplateid: number;
  prepaidpackagetemplatename: string;
  resellerid: number;
  priority: number;
  locationzoneid: number;
  databyte: number;
  mocsecond: number;
  mtcsecond: number;
  mosmsnumber: number;
  mtsmsnumber: number;
  perioddays: number;
  deleted: boolean;
  esimSponsor: number;
  cost: number;
  uiStartAvailablePeriod?: string;
  uiEndAvailibilityPeriod?: string;
  uiVisible: boolean;
  userUiName?: string;
  sponsors?: {
    sponsorid: number;
    sponsorname: string;
    displayname: string;
  };
  reseller?: {
    resellerid: number;
    resellername: string;
  };
  rdbLocationZones?: {
    locationzoneid: number;
    locationzonename: string;
  };
  rdbDestinationZones?: {
    destinationzoneid: number;
    destinationzonename: string;
  };
}

export interface AffectPackageResult {
  iccid: string;
  smdpServer: string;
  activationCode: string;
  urlQrCode: string;
  subscriberId: number;
  esimId: number;
  subsPackageId: number;
  userSimName?: string;
}

export interface UpstreamStatus {
  code: number;
  msg: string;
}

export interface UpstreamResponse<T = unknown> {
  status: UpstreamStatus;
  [methodName: string]: T | UpstreamStatus;
}

export interface AffectPackageToSubscriberParams {
  packageTemplateId: number;
  accountForSubs: number;
  validityPeriod?: number;
}
