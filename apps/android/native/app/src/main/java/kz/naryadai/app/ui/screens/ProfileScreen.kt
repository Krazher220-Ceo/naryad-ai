package kz.naryadai.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kz.naryadai.app.BuildConfig
import kz.naryadai.app.Graph
import kz.naryadai.app.R
import kz.naryadai.app.ui.components.BrandHeader
import kz.naryadai.app.ui.components.ConnectionPill
import kz.naryadai.app.ui.components.InfoCard
import kz.naryadai.app.ui.components.LanguageToggle
import kz.naryadai.app.ui.components.PrimaryButton
import kz.naryadai.app.ui.components.SecondaryButton
import kz.naryadai.app.ui.components.SectionTitle
import kz.naryadai.app.ui.theme.Brand
import kz.naryadai.app.ui.theme.Canvas
import kz.naryadai.app.ui.theme.Danger
import kz.naryadai.app.ui.theme.Ink
import kz.naryadai.app.ui.theme.InkMuted
import kz.naryadai.app.ui.theme.Oswald
import kz.naryadai.app.util.initials

@Composable
fun ProfileScreen() {
    val repo = Graph.repo
    val employee by Graph.session.employee.collectAsState()
    val online by repo.online.collectAsState()
    val pending by repo.pending.collectAsState()
    val flushing by repo.flushing.collectAsState()
    val scope = rememberCoroutineScope()
    var confirmLogout by remember { mutableStateOf(false) }
    val name = employee?.fullName.orEmpty()
    val roleRes = when (employee?.role) {
        "master" -> R.string.role_master
        "lead" -> R.string.role_lead
        "operator" -> R.string.role_operator
        else -> R.string.role_worker
    }

    Column(Modifier.fillMaxSize().background(Canvas)) {
        BrandHeader(title = stringResource(R.string.profile_title), trailing = { ConnectionPill(online, pending.size) })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            InfoCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Box(Modifier.size(64.dp).background(Brand, CircleShape), contentAlignment = Alignment.Center) {
                        Text(initials(name), style = MaterialTheme.typography.headlineSmall.copy(fontFamily = Oswald), color = Color.White)
                    }
                    Column {
                        Text(name, style = MaterialTheme.typography.titleMedium, color = Ink)
                        Text(stringResource(roleRes), style = MaterialTheme.typography.bodyMedium, color = InkMuted)
                        employee?.login?.takeIf { it.isNotBlank() }?.let {
                            Text(stringResource(R.string.profile_login, it), style = MaterialTheme.typography.bodySmall, color = InkMuted)
                        }
                    }
                }
            }

            InfoCard {
                SectionTitle(stringResource(R.string.language))
                LanguageToggle(minItemWidth = 96.dp)
            }

            InfoCard {
                SectionTitle(stringResource(R.string.profile_device))
                Text(
                    if (pending.isEmpty()) stringResource(R.string.profile_pending_none) else stringResource(R.string.profile_pending, pending.size),
                    style = MaterialTheme.typography.bodyLarge,
                    color = Ink,
                )
                if (pending.isNotEmpty()) {
                    PrimaryButton(
                        stringResource(R.string.profile_send_now),
                        onClick = { scope.launch { repo.flush(notify = true) } },
                        loading = flushing,
                    )
                }
            }

            SecondaryButton(stringResource(R.string.profile_sign_out), { confirmLogout = true }, Modifier.fillMaxWidth(), danger = true)

            Text(
                stringResource(R.string.profile_version, BuildConfig.VERSION_NAME) + " · " + stringResource(R.string.profile_demo),
                style = MaterialTheme.typography.bodySmall,
                color = InkMuted,
            )
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text(stringResource(R.string.profile_sign_out), style = MaterialTheme.typography.titleMedium) },
            text = { Text(stringResource(R.string.profile_sign_out_confirm), style = MaterialTheme.typography.bodyLarge) },
            confirmButton = {
                TextButton(onClick = { confirmLogout = false; scope.launch { repo.logout() } }, modifier = Modifier.padding(4.dp)) {
                    Text(stringResource(R.string.profile_sign_out), color = Danger, style = MaterialTheme.typography.labelLarge)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmLogout = false }, modifier = Modifier.padding(4.dp)) {
                    Text(stringResource(R.string.cancel), style = MaterialTheme.typography.labelLarge)
                }
            },
            containerColor = androidx.compose.ui.graphics.Color.White,
        )
    }
}
