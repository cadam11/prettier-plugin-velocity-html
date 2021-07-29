class AuthenticationFlow {

  String id

  AuthenticationFlow(String id) {
    this.id = id
  }

  boolean test(Object something) {
    true
  }

}

new ShibbolethCommon().makeCommonData() + [
  'extendedAuthenticationFlows': [new AuthenticationFlow('nPA')]
]
