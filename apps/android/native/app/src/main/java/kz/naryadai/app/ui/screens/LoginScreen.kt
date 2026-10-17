// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.data.ApiException
import kz.naryadai.app.data.NoProfileException
import kz.naryadai.app.data.NotWorkerException
import kz.naryadai.app.ui.components.LanguageToggle
import kz.naryadai.app.ui.components.PrimaryButton
import kz.naryadai.app.ui.theme.Accent
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.DangerSoft
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.LineStrong
import kz.naryadai.app.ui.theme.Oswald
import kz.naryadai.app.ui.theme.Surface
import java.io.IOException

private sealed interface LoginError {
    data object Empty : LoginError
    data object Invalid : LoginError
    data object NoProfile : LoginError
    data object NotWorker : LoginError
    data object Network : LoginError
    data class Server(val text: String) : LoginError
}

@Composable
fun LoginScreen() {
    var login by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var loading by rememberSaveable { mutableStateOf(false) }
    var error by androidx.compose.runtime.remember { mutableStateOf<LoginError?>(null) }
    val scope = rememberCoroutineScope()

    fun submit() {
        if (loading) return
        if (login.isBlank() || password.isBlank()) {
            error = LoginError.Empty
            return
        }
        loading = true
        error = null
        scope.launch {
            try {
                // После успеха сам вход запускает переход на «Наряды» (см. AppRoot)
                Graph.repo.login(login, password)
            } catch (e: NoProfileException) {
                error = LoginError.NoProfile
            } catch (e: NotWorkerException) {
                error = LoginError.NotWorker
            } catch (e: ApiException) {
                error = if (e.status in 400..401 || e.status == 422) LoginError.Invalid else LoginError.Server(e.message ?: "")
            } catch (e: IOException) {
                error = LoginError.Network
            }
            loading = false
        }
    }

    Column(Modifier.fillMaxSize().background(Canvas).imePadding()) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            // Синий верх с названием
            Column(Modifier.fillMaxWidth().background(Brand)) {
                Row(Modifier.statusBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Spacer(Modifier.weight(1f))
                    LanguageToggle(onDark = true)
                }
                Column(Modifier.padding(horizontal = 24.dp).padding(top = 12.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(width = 56.dp, height = 6.dp).background(Accent, RoundedCornerShape(3.dp)))
                    Spacer(Modifier.height(10.dp))
                    Text(
                        stringResource(R.string.app_name),
                        style = MaterialTheme.typography.headlineLarge.copy(fontFamily = Oswald, fontSize = 44.sp, lineHeight = 50.sp),
                        color = Color.White,
                    )
                    Text(stringResource(R.string.brand_tagline), style = MaterialTheme.typography.bodyLarge, color = Color.White.copy(alpha = 0.9f))
                }
                Box(Modifier.fillMaxWidth().height(4.dp).background(Accent))
            }

            Column(Modifier.padding(horizontal = 20.dp).padding(top = 28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(stringResource(R.string.login_title), style = MaterialTheme.typography.headlineMedium, color = Ink)

                val fieldColors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Surface,
                    unfocusedContainerColor = Surface,
                    focusedBorderColor = Brand,
                    unfocusedBorderColor = LineStrong,
                )
                OutlinedTextField(
                    value = login,
                    onValueChange = { login = it },
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 60.dp),
                    label = { Text(stringResource(R.string.login_field)) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    textStyle = MaterialTheme.typography.bodyLarge,
                    colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Next),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 60.dp),
                    label = { Text(stringResource(R.string.password)) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    textStyle = MaterialTheme.typography.bodyLarge,
                    colors = fieldColors,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }, modifier = Modifier.size(56.dp)) {
                            Icon(
                                if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                contentDescription = stringResource(if (showPassword) R.string.hide_password else R.string.show_password),
                                tint = InkMuted,
                            )
                        }
                    },
                )

                error?.let { e ->
                    val text = when (e) {
                        LoginError.Empty -> stringResource(R.string.login_error_empty)
                        LoginError.Invalid -> stringResource(R.string.login_error_invalid)
                        LoginError.NoProfile -> stringResource(R.string.login_error_no_profile)
                        LoginError.NotWorker -> stringResource(R.string.login_not_worker)
                        LoginError.Network -> stringResource(R.string.login_no_network)
                        is LoginError.Server -> e.text
                    }
                    Text(
                        text,
                        modifier = Modifier.fillMaxWidth().background(DangerSoft, RoundedCornerShape(12.dp)).padding(14.dp),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
                        color = Danger,
                    )
                }

                Text(stringResource(R.string.login_demo_hint), style = MaterialTheme.typography.bodySmall, color = InkMuted)
            }
        }

        // Главное действие — внизу экрана
        Column(Modifier.fillMaxWidth().background(Surface).navigationBarsPadding().padding(16.dp)) {
            PrimaryButton(stringResource(R.string.login_submit), onClick = ::submit, loading = loading)
        }
    }
}
