const errorMessage = {
  inactiveEntity: " Inactive Entity, try again later",
  entitySuspended:
    "Permission denied, entity has been suspended try again later",
  notFound: "Not found",
  internalServerError: "Internal Server Error",
  routeNotFound: "Route not found, please try something new",
  uncaughtException: "Uncaught Exception",
  inactiveAccountCheckEmailToActivate:
    "Your account has been deactivated please check your email to activate the account",
  permissionDenied: "Permission denied",
  adminNotFound: "Admin not found",
  businessNotFound: "Business not found",
  userNotFound: "User not found",
  superAdminNotFound: "SuperAdmin not found",
  entityNotFound: "Entity not found",
  democraticNotFound: "Democratic not found",
  somethingWentWrong: "Something went wrong",
  activateThroughOurHelpDesk:
    "Email inactive, Please activate your email through our help desk",
  emailNotFound: "Email not found",
  socialMediaLoginNotAvailableForThisAccount:
    "Social media login is not available for this account",
  provideNecessaryInformation: "Please provide all necessary Information",
  newsAdAlreadyExistsForEntity: "news Ad already exist for this entity",
  multipleNewsNotAllowed: "Multiple entry not allowed",
  accountSuspended: "Account suspended",
  captchaVerificationFailed: "CAPTCHA verification failed, please try again",
  captchaVerificationError:
    "CAPTCHA verification error, please try again sometimes later",
  completeTheCaptcha: "Please complete the CAPTCHA",
  incompatibleType: "Incompatible type",
};
const EMAIL_CONFIG_INFO = {
  EMAIL_SERVICE: process.env.EMAIL_SERVICE,
  EMAIL_SENDER_USER: process.env.EMAIL_SENDER_USER,
  EMAIL_SENDER_PASSWORD: process.env.EMAIL_SENDER_PASSWORD,
};
