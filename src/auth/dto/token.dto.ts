export default class TokenDto {
  accessToken: string;
  refreshToken?: string; // Optional, deprecated - kept for backwards compatibility

  constructor(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
