package com.muruk.repo

import com.muruk.domain.AppUser
import com.muruk.domain.UserState
import org.springframework.data.jpa.repository.JpaRepository

interface AppUserRepository : JpaRepository<AppUser, String>

interface UserStateRepository : JpaRepository<UserState, String>
