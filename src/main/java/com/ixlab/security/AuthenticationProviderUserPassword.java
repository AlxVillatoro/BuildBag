package com.ixlab.security;

import com.ixlab.service.UserService;
import io.micronaut.security.authentication.*;
import io.micronaut.core.async.publisher.Publishers;
import io.micronaut.http.HttpRequest;
import jakarta.inject.Singleton;

import org.reactivestreams.Publisher;

import java.util.Collections;

@Singleton
public class AuthenticationProviderUserPassword implements AuthenticationProvider {

    private final UserService userService;

    public AuthenticationProviderUserPassword(UserService userService) {
        this.userService = userService;
    }

	@Override
	public Publisher<AuthenticationResponse> authenticate(HttpRequest<?> httpRequest,
			AuthenticationRequest<?, ?> authenticationRequest) {
		String identity = (String) authenticationRequest.getIdentity();
        String secret = (String) authenticationRequest.getSecret();

        if (userService.authenticate(identity, secret).isPresent()) {
            return Publishers.just(AuthenticationResponse.success(identity, Collections.emptyList()));
        } else {
            return Publishers.just(new AuthenticationFailed());
        }
	}
}
