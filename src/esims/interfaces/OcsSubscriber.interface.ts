// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface OcsSubscriber {
  subscriberId: number;
  imsiList?: { imsi: string }[];
  sim?: {
    iccid?: string;
    smdpServer?: string;
    activationCode?: string;
    status?: string;
  };
  phoneNumberList?: { phoneNumber: string }[];
  batchId?: string;
  accountId: number;
  resellerId: number;
  prepaid: boolean;
  balance: number;
  status?: { status: string }[];
  activationDate?: string;
}
